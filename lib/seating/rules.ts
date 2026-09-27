import { isTable, tableName, type SeatingWords } from "./geometry";
import type { SeatingGuest, SeatingRelationship, SeatingState } from "./types";

export type IssueType = "keep_apart" | "keep_together" | "child_alone" | "not_attending";

/** names: the guests involved, for the message (see messages "seating.issues") */
export type TableIssue = { type: IssueType; names: string[]; guestIds: string[] };

export type SeatingAnalysis = {
  /** table id → problems at that table */
  byTable: Record<string, TableIssue[]>;
  totals: {
    tables: number;
    seats: number;
    seated: number;
    attending: number;
    /** attending guests without a seat */
    unseatedAttending: number;
    /** attending guests minus seats (0 when there are enough seats) */
    seatsShort: number;
  };
};

/** Checks the seating chart against the guests' rules and RSVPs. */
export function analyzeSeating(
  state: SeatingState,
  guests: Map<string, SeatingGuest>,
  relationships: SeatingRelationship[],
): SeatingAnalysis {
  const byTable: Record<string, TableIssue[]> = {};
  const add = (tableId: string, issue: TableIssue) => (byTable[tableId] ??= []).push(issue);
  const name = (id: string) => guests.get(id)?.name ?? "";
  const tableOf = (id: string) => state.assignments[id]?.objectId;

  // keep apart / keep together
  for (const r of relationships) {
    const ta = tableOf(r.guestA);
    const tb = tableOf(r.guestB);
    if (!ta || !tb) continue; // only judge when both are seated
    if (r.type === "keep_apart" && ta === tb) {
      add(ta, {
        type: "keep_apart",
        names: [name(r.guestA), name(r.guestB)],
        guestIds: [r.guestA, r.guestB],
      });
    }
    if (r.type === "keep_together" && ta !== tb) {
      const issue: TableIssue = {
        type: "keep_together",
        names: [name(r.guestA), name(r.guestB)],
        guestIds: [r.guestA, r.guestB],
      };
      add(ta, issue);
      add(tb, issue);
    }
  }

  // children need an adult from their own household at the same table;
  // seated guests who declined should probably be removed
  const atTable = new Map<string, string[]>();
  for (const a of Object.values(state.assignments)) {
    const list = atTable.get(a.objectId) ?? [];
    list.push(a.guestId);
    atTable.set(a.objectId, list);
  }
  for (const [tableId, ids] of atTable) {
    const people = ids.map((id) => guests.get(id)).filter((g): g is SeatingGuest => !!g);
    for (const g of people) {
      if (g.ageGroup !== "adult") {
        const hasAdult = people.some(
          (p) => p.ageGroup === "adult" && p.householdId === g.householdId,
        );
        if (!hasAdult) {
          add(tableId, {
            type: "child_alone",
            names: [g.name],
            guestIds: [g.id],
          });
        }
      }
      if (g.rsvp === "declined") {
        add(tableId, {
          type: "not_attending",
          names: [g.name],
          guestIds: [g.id],
        });
      }
    }
  }

  const tables = Object.values(state.objects).filter((o) => isTable(o.kind));
  const seats = tables.reduce((n, t) => n + t.seatCount, 0);
  const attendingIds = [...guests.values()].filter((g) => g.rsvp === "attending").map((g) => g.id);
  return {
    byTable,
    totals: {
      tables: tables.length,
      seats,
      seated: Object.keys(state.assignments).length,
      attending: attendingIds.length,
      unseatedAttending: attendingIds.filter((id) => !state.assignments[id]).length,
      seatsShort: Math.max(0, attendingIds.length - seats),
    },
  };
}

/** Flat list of all problems, one entry per issue (for the warnings panel). */
export function allIssues(state: SeatingState, analysis: SeatingAnalysis, words?: SeatingWords) {
  const seen = new Set<string>();
  const list: (TableIssue & { tableId: string; tableName: string })[] = [];
  for (const [tableId, issues] of Object.entries(analysis.byTable)) {
    const t = state.objects[tableId];
    for (const issue of issues) {
      // keep-together issues appear on two tables; list them once
      const key = `${issue.type}:${[...issue.guestIds].sort().join(",")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      list.push({ ...issue, tableId, tableName: t ? tableName(t, words) : "" });
    }
  }
  return list;
}
