import { isTable } from "./geometry";
import type { SeatingGuest, SeatingRelationship, SeatingState } from "./types";

/*
 * AUTO-ARRANGE: a simple "greedy" algorithm.
 *
 * It only fills EMPTY seats with guests who don't have one yet; nobody who is
 * already seated is moved.
 *
 * 1. Group the guests to seat into "units" that must sit together: everyone in
 *    the same household, joined with anyone linked by a "keep together" rule.
 * 2. Seat the biggest units first (they're the hardest to fit).
 * 3. For each unit, score every table that has enough free seats and where
 *    nobody has a "keep apart" rule with a unit member. Scores are configurable
 *    via ArrangeWeights (all have sensible defaults).
 * 4. If no table can take the whole unit, its members are seated one by one
 *    using the same scoring (so a big family may be split across two tables).
 *
 * Greedy means it never goes back to reconsider earlier choices, so the result
 * is good but not perfect. The editor shows it as a proposal you can undo.
 */

export type ArrangeWeights = {
  keepTogether: number;
  side: number;
  tag: number;
  language: number;
  ageGroup: number;
  hostPrefer: number;
  fillFirst: number;
};

export const DEFAULT_WEIGHTS: ArrangeWeights = {
  keepTogether: 100,
  side: 3,
  tag: 2,
  language: 4,
  ageGroup: 2,
  hostPrefer: 5,
  fillFirst: 1,
};

export type TableScore = {
  tableId: string;
  total: number;
  reasons: string[];
};

type Unit = { guests: SeatingGuest[]; key: string };

export type AutoArrangeResult = {
  state: SeatingState;
  placed: string[];
  unplaced: string[];
  tableScores: Record<string, TableScore>;
};

export type AutoArrangeOptions = {
  weights?: Partial<ArrangeWeights>;
  hostTagId?: string | null;
};

export function autoArrange(
  state: SeatingState,
  /** guests who should get a seat (typically: attending, not yet seated) */
  candidates: SeatingGuest[],
  /** every guest (to look up people already seated) */
  allGuests: Map<string, SeatingGuest>,
  relationships: SeatingRelationship[],
  options?: AutoArrangeOptions,
): AutoArrangeResult {
  const w: ArrangeWeights = { ...DEFAULT_WEIGHTS, ...options?.weights };
  const hostTagId = options?.hostTagId ?? null;
  const toSeat = candidates.filter((g) => !state.assignments[g.id]);
  const assignments = { ...state.assignments };

  const tables = Object.values(state.objects).filter((o) => isTable(o.kind) && o.seatCount > 0);
  const occupants = new Map<string, string[]>(tables.map((t) => [t.id, []]));
  for (const a of Object.values(assignments)) occupants.get(a.objectId)?.push(a.guestId);
  const freeSeats = (tableId: string) => {
    const t = state.objects[tableId];
    const taken = new Set(
      Object.values(assignments)
        .filter((a) => a.objectId === tableId)
        .map((a) => a.seatIndex),
    );
    return Array.from({ length: t.seatCount }, (_, i) => i).filter((i) => !taken.has(i));
  };

  const apart = new Map<string, Set<string>>();
  const together = new Map<string, Set<string>>();
  for (const r of relationships) {
    const map = r.type === "keep_apart" ? apart : together;
    if (!map.has(r.guestA)) map.set(r.guestA, new Set());
    if (!map.has(r.guestB)) map.set(r.guestB, new Set());
    map.get(r.guestA)!.add(r.guestB);
    map.get(r.guestB)!.add(r.guestA);
  }

  const units = buildUnits(toSeat, together);
  const tableScores: Record<string, TableScore> = {};

  function isLonely(g: SeatingGuest) {
    return (
      !together.has(g.id) &&
      !apart.has(g.id) &&
      !Object.values(assignments).some(
        (a) => allGuests.get(a.guestId)?.householdId === g.householdId,
      )
    );
  }

  function score(tableId: string, unit: SeatingGuest[]) {
    const here = occupants.get(tableId) ?? [];
    if (unit.some((g) => here.some((o) => apart.get(g.id)?.has(o)))) return -Infinity;
    let s = here.length > 0 ? w.fillFirst : 0;
    for (const g of unit) {
      for (const oid of here) {
        if (together.get(g.id)?.has(oid)) s += w.keepTogether;
        const o = allGuests.get(oid);
        if (!o) continue;
        if (o.side === g.side && w.side > 0) s += w.side;
        if (w.tag > 0) s += w.tag * g.tagIds.filter((t) => o.tagIds.includes(t)).length;
        if (w.language > 0 && g.languages.length > 0 && o.languages.length > 0) {
          s += w.language * g.languages.filter((l) => o.languages.includes(l)).length;
        }
        if (w.ageGroup > 0 && o.ageGroup === g.ageGroup) s += w.ageGroup;
      }
      if (w.hostPrefer > 0 && hostTagId && isLonely(g)) {
        if (here.some((oid) => allGuests.get(oid)?.tagIds.includes(hostTagId))) {
          s += w.hostPrefer;
        }
      }
    }
    return s;
  }

  function bestTable(unit: SeatingGuest[]) {
    let best: { id: string; score: number; free: number } | null = null;
    for (const t of tables) {
      const free = freeSeats(t.id).length;
      if (free < unit.length) continue;
      const s = score(t.id, unit);
      if (s === -Infinity) continue;
      if (!best || s > best.score || (s === best.score && free < best.free)) {
        best = { id: t.id, score: s, free };
      }
    }
    return best?.id ?? null;
  }

  function seat(unit: SeatingGuest[], tableId: string) {
    const t = state.objects[tableId];
    const free = freeSeats(tableId);
    const start = bestStartSeat(free, t.seatCount, unit.length);
    const order = Array.from({ length: t.seatCount }, (_, i) => (start + i) % t.seatCount).filter(
      (i) => free.includes(i),
    );
    unit.forEach((g, i) => {
      assignments[g.id] = { guestId: g.id, objectId: tableId, seatIndex: order[i] };
      occupants.get(tableId)!.push(g.id);
      placed.push(g.id);
    });
  }

  const placed: string[] = [];
  const unplaced: string[] = [];
  for (const unit of units) {
    const tableId = bestTable(unit.guests);
    if (tableId) {
      seat(unit.guests, tableId);
      continue;
    }
    const members = [...unit.guests].sort(
      (a, b) => Number(a.ageGroup !== "adult") - Number(b.ageGroup !== "adult"),
    );
    for (const g of members) {
      const id = bestTable([g]);
      if (id) seat([g], id);
      else unplaced.push(g.id);
    }
  }

  for (const t of tables) {
    const here = occupants.get(t.id) ?? [];
    if (here.length === 0) continue;
    const reasons: string[] = [];
    const langs = new Set<string>();
    const sides = new Set<string>();
    let hasHost = false;
    for (const oid of here) {
      const o = allGuests.get(oid);
      if (!o) continue;
      sides.add(o.side);
      for (const l of o.languages) langs.add(l);
      if (hostTagId && o.tagIds.includes(hostTagId)) hasHost = true;
    }
    if (langs.size > 0) reasons.push(`language:${[...langs].join(",")}`);
    if (sides.size === 1 && sides.values().next().value !== "both")
      reasons.push(`side:${sides.values().next().value}`);
    if (hasHost) reasons.push("host");
    tableScores[t.id] = { tableId: t.id, total: here.length, reasons };
  }

  return { state: { ...state, assignments }, placed, unplaced, tableScores };
}

/** Households + keep-together links → groups (union-find). Largest first. */
function buildUnits(guests: SeatingGuest[], together: Map<string, Set<string>>): Unit[] {
  const parent = new Map(guests.map((g) => [g.id, g.id]));
  const find = (x: string): string => {
    const p = parent.get(x)!;
    if (p === x) return x;
    const root = find(p);
    parent.set(x, root);
    return root;
  };
  const union = (a: string, b: string) => {
    if (parent.has(a) && parent.has(b)) parent.set(find(a), find(b));
  };

  const firstInHousehold = new Map<string, string>();
  for (const g of guests) {
    const first = firstInHousehold.get(g.householdId);
    if (first) union(first, g.id);
    else firstInHousehold.set(g.householdId, g.id);
    for (const other of together.get(g.id) ?? []) union(g.id, other);
  }

  const groups = new Map<string, SeatingGuest[]>();
  for (const g of guests) {
    const root = find(g.id);
    groups.set(root, [...(groups.get(root) ?? []), g]);
  }
  return [...groups.values()]
    .map((list) => ({
      // adults first, plus-ones after their host
      guests: [...list].sort((a, b) => Number(!!a.plusOneOf) - Number(!!b.plusOneOf)),
      key: `${list[0].side}:${list[0].householdName}`,
    }))
    .sort((a, b) => b.guests.length - a.guests.length || a.key.localeCompare(b.key));
}

/** First seat of the longest run of neighbouring free seats (seats wrap around). */
export function bestStartSeat(free: number[], seatCount: number, needed: number) {
  if (free.length === 0) return 0;
  const isFree = new Set(free);
  let bestStart = free[0];
  let bestRun = 0;
  for (const start of free) {
    if (isFree.has((start - 1 + seatCount) % seatCount) && free.length < seatCount) continue; // not a run start
    let run = 0;
    while (run < seatCount && isFree.has((start + run) % seatCount)) run++;
    // prefer the smallest run that still fits, otherwise the longest
    const better =
      (run >= needed && (bestRun < needed || run < bestRun)) || (bestRun < needed && run > bestRun);
    if (better) {
      bestRun = run;
      bestStart = start;
    }
  }
  return bestStart;
}
