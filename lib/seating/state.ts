import { clampSeats, isTable, KINDS, tableSize } from "./geometry";
import type { Assignment, Room, SeatingKind, SeatingObject, SeatingState } from "./types";

// Pure functions: each takes the current state and returns a NEW state.
// The editor keeps old states for undo/redo and saves only what changed
// (see diffStates below).

// ---------------------------------------------------------------------------
// Tables and decor
// ---------------------------------------------------------------------------

/** Next free table number (1, 2, 3…). */
export function nextTableNumber(state: SeatingState) {
  const used = new Set(Object.values(state.objects).map((o) => o.number));
  let n = 1;
  while (used.has(n)) n++;
  return n;
}

export function createObject(
  state: SeatingState,
  kind: SeatingKind,
  at: { x: number; y: number },
  id: string,
): SeatingObject {
  const info = KINDS[kind];
  const seatCount = info.defaultSeats;
  const size = tableSize(kind, seatCount, false);
  return {
    id,
    kind,
    label: kind === "label" ? "Label" : info.seated ? null : info.label,
    number: info.seated && kind !== "sweetheart" ? nextTableNumber(state) : null,
    x: at.x,
    y: at.y,
    rotation: 0,
    width: size.width,
    height: size.height,
    seatCount,
    ends: false,
  };
}

export function addObject(state: SeatingState, obj: SeatingObject): SeatingState {
  return { ...state, objects: { ...state.objects, [obj.id]: obj } };
}

/**
 * Changes a table or decor item. For tables, changing seats resizes the table
 * and unseats anyone in seats that no longer exist.
 */
export function updateObject(
  state: SeatingState,
  id: string,
  patch: Partial<Omit<SeatingObject, "id" | "kind">>,
): SeatingState {
  const old = state.objects[id];
  if (!old) return state;
  let next: SeatingObject = { ...old, ...patch };

  if (isTable(old.kind) && ("seatCount" in patch || "ends" in patch)) {
    const seatCount = clampSeats(old.kind, next.seatCount);
    const ends = old.kind === "rect" && next.ends && seatCount >= 4;
    next = { ...next, seatCount, ends, ...tableSize(old.kind, seatCount, ends) };
  }

  let assignments = state.assignments;
  if (next.seatCount < old.seatCount) {
    assignments = Object.fromEntries(
      Object.entries(assignments).filter(
        ([, a]) => a.objectId !== id || a.seatIndex < next.seatCount,
      ),
    );
  }
  return { ...state, objects: { ...state.objects, [id]: next }, assignments };
}

export function deleteObject(state: SeatingState, id: string): SeatingState {
  const objects = { ...state.objects };
  delete objects[id];
  const assignments = Object.fromEntries(
    Object.entries(state.assignments).filter(([, a]) => a.objectId !== id),
  );
  return { ...state, objects, assignments };
}

/** Copy of a table (without its guests), placed a little to the side. */
export function duplicateObject(state: SeatingState, id: string, newId: string): SeatingState {
  const o = state.objects[id];
  if (!o) return state;
  const copy: SeatingObject = {
    ...o,
    id: newId,
    x: o.x + Math.max(60, o.width * 0.6),
    y: o.y + Math.max(60, o.height * 0.6),
    number: isTable(o.kind) && o.number != null ? nextTableNumber(state) : o.number,
  };
  return addObject(state, copy);
}

export function setRoom(state: SeatingState, room: Room): SeatingState {
  return { ...state, room };
}

// ---------------------------------------------------------------------------
// Guests in seats
// ---------------------------------------------------------------------------

/** Who sits where: "objectId:seatIndex" → guest id. */
export function seatMap(state: SeatingState) {
  const map = new Map<string, string>();
  for (const a of Object.values(state.assignments))
    map.set(`${a.objectId}:${a.seatIndex}`, a.guestId);
  return map;
}

export function freeSeats(state: SeatingState, objectId: string) {
  const o = state.objects[objectId];
  if (!o) return [];
  const taken = seatMap(state);
  return Array.from({ length: o.seatCount }, (_, i) => i).filter(
    (i) => !taken.has(`${objectId}:${i}`),
  );
}

/**
 * Puts a guest in a specific seat. If someone already sits there, the two
 * swap (or the other person is unseated if the moving guest had no seat).
 */
export function assignSeat(
  state: SeatingState,
  guestId: string,
  objectId: string,
  seatIndex: number,
): SeatingState {
  const o = state.objects[objectId];
  if (!o || seatIndex < 0 || seatIndex >= o.seatCount) return state;
  const assignments = { ...state.assignments };
  const from = assignments[guestId];
  const occupant = seatMap(state).get(`${objectId}:${seatIndex}`);
  if (occupant === guestId) return state;

  if (occupant) {
    if (from)
      assignments[occupant] = {
        guestId: occupant,
        objectId: from.objectId,
        seatIndex: from.seatIndex,
      };
    else delete assignments[occupant];
  }
  assignments[guestId] = { guestId, objectId, seatIndex };
  return { ...state, assignments };
}

/**
 * Seats several guests (e.g. a household) at a table in free seats, starting
 * at `startSeat` if given and going round the table so they sit together.
 * Returns the new state and the guests that didn't fit.
 */
export function assignToTable(
  state: SeatingState,
  guestIds: string[],
  objectId: string,
  startSeat?: number,
): { state: SeatingState; unplaced: string[] } {
  const o = state.objects[objectId];
  if (!o || !isTable(o.kind)) return { state, unplaced: guestIds };

  // Guests already at this table stay where they are.
  const moving = guestIds.filter((g) => state.assignments[g]?.objectId !== objectId);
  // Free their current seats first, so they don't block each other.
  let next: SeatingState = { ...state, assignments: { ...state.assignments } };
  for (const g of moving) delete next.assignments[g];

  const free = new Set(freeSeats(next, objectId));
  const start = startSeat ?? 0;
  const order = Array.from({ length: o.seatCount }, (_, i) => (start + i) % o.seatCount).filter(
    (i) => free.has(i),
  );

  const unplaced: string[] = [];
  moving.forEach((g, i) => {
    if (i < order.length) next.assignments[g] = { guestId: g, objectId, seatIndex: order[i] };
    else unplaced.push(g);
  });
  // Anyone who didn't fit keeps their old seat.
  for (const g of unplaced) if (state.assignments[g]) next.assignments[g] = state.assignments[g];
  next = { ...next };
  return { state: next, unplaced };
}

export function unassign(state: SeatingState, guestIds: string[]): SeatingState {
  const assignments = { ...state.assignments };
  for (const g of guestIds) delete assignments[g];
  return { ...state, assignments };
}

// ---------------------------------------------------------------------------
// Saving: what changed between two states
// ---------------------------------------------------------------------------

/** null means "deleted" / "unseated". */
export type SeatingChanges = {
  room?: Room;
  objects: Record<string, SeatingObject | null>;
  assignments: Record<string, Assignment | null>;
};

export const noChanges = (): SeatingChanges => ({ objects: {}, assignments: {} });

export function isEmptyChanges(c: SeatingChanges) {
  return !c.room && Object.keys(c.objects).length === 0 && Object.keys(c.assignments).length === 0;
}

const sameObject = (a: SeatingObject, b: SeatingObject) =>
  (Object.keys(a) as (keyof SeatingObject)[]).every((k) => a[k] === b[k]);

const sameAssignment = (a: Assignment, b: Assignment) =>
  a.objectId === b.objectId && a.seatIndex === b.seatIndex;

export function diffStates(before: SeatingState, after: SeatingState): SeatingChanges {
  const changes = noChanges();
  if (before.room.width !== after.room.width || before.room.height !== after.room.height) {
    changes.room = after.room;
  }
  for (const [id, o] of Object.entries(after.objects)) {
    const old = before.objects[id];
    if (!old || !sameObject(old, o)) changes.objects[id] = o;
  }
  for (const id of Object.keys(before.objects)) if (!after.objects[id]) changes.objects[id] = null;

  for (const [g, a] of Object.entries(after.assignments)) {
    const old = before.assignments[g];
    if (!old || !sameAssignment(old, a)) changes.assignments[g] = a;
  }
  for (const g of Object.keys(before.assignments))
    if (!after.assignments[g]) changes.assignments[g] = null;
  return changes;
}

/** Combines two batches of changes; the later one wins for each item. */
export function mergeChanges(a: SeatingChanges, b: SeatingChanges): SeatingChanges {
  return {
    room: b.room ?? a.room,
    objects: { ...a.objects, ...b.objects },
    assignments: { ...a.assignments, ...b.assignments },
  };
}

/** JSON sent to the apply_seating_changes() database function. */
export function toPayload(c: SeatingChanges) {
  const objects = Object.entries(c.objects);
  const assignments = Object.entries(c.assignments);
  return {
    ...(c.room
      ? { layout: { room_width: Math.round(c.room.width), room_height: Math.round(c.room.height) } }
      : {}),
    objects: objects
      .filter(([, o]) => o)
      .map(([, o]) => ({
        id: o!.id,
        kind: o!.kind,
        label: o!.label,
        number: o!.number,
        x: o!.x,
        y: o!.y,
        rotation: o!.rotation,
        width: o!.width,
        height: o!.height,
        seat_count: o!.seatCount,
        ends: o!.ends,
      })),
    deleted_objects: objects.filter(([, o]) => !o).map(([id]) => id),
    assign: assignments
      .filter(([, a]) => a)
      .map(([, a]) => ({ guest_id: a!.guestId, object_id: a!.objectId, seat_index: a!.seatIndex })),
    unassign: assignments.filter(([, a]) => !a).map(([g]) => g),
  };
}
