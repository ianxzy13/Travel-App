import { describe, expect, it } from "vitest";
import { autoArrange, bestStartSeat } from "../auto-arrange";
import { initials, seatPositions, tableName, tableSize, toRoom } from "../geometry";
import { analyzeSeating } from "../rules";
import {
  assignSeat,
  assignToTable,
  createObject,
  deleteObject,
  diffStates,
  duplicateObject,
  mergeChanges,
  toPayload,
  unassign,
  updateObject,
} from "../state";
import type { SeatingGuest, SeatingObject, SeatingState } from "../types";

const empty: SeatingState = { room: { width: 2000, height: 1400 }, objects: {}, assignments: {} };

function table(id: string, seats: number, kind: SeatingObject["kind"] = "round"): SeatingObject {
  return {
    id,
    kind,
    label: null,
    number: 1,
    x: 0,
    y: 0,
    rotation: 0,
    ...tableSize(kind, seats),
    seatCount: seats,
    ends: false,
  };
}

function guest(id: string, extra: Partial<SeatingGuest> = {}): SeatingGuest {
  return {
    id,
    name: id,
    firstName: id,
    lastName: "",
    householdId: `h-${id}`,
    householdName: id,
    side: "both",
    ageGroup: "adult",
    tagIds: [],
    dietary: null,
    accessibility: null,
    plusOneOf: null,
    rsvp: "attending",
    mealOptionId: null,
    ...extra,
  };
}

function withTables(...tables: SeatingObject[]): SeatingState {
  return { ...empty, objects: Object.fromEntries(tables.map((t) => [t.id, t])) };
}

describe("geometry", () => {
  it("places the right number of seats around every table type", () => {
    for (const kind of ["round", "rect", "square", "head", "sweetheart"] as const) {
      for (const n of [2, 5, 8, 12]) {
        const seats = kind === "sweetheart" ? 2 : n;
        const t = {
          kind,
          seatCount: seats,
          ends: kind === "rect",
          ...tableSize(kind, seats, kind === "rect"),
        };
        expect(seatPositions(t)).toHaveLength(seats);
      }
    }
  });

  it("puts round-table seats outside the table", () => {
    const t = table("t", 8);
    for (const p of seatPositions(t)) expect(Math.hypot(p.x, p.y)).toBeGreaterThan(t.width / 2);
  });

  it("grows tables with their seats and rotates points", () => {
    expect(tableSize("round", 12).width).toBeGreaterThan(tableSize("round", 6).width);
    const p = toRoom({ x: 100, y: 100, rotation: 90 }, { x: 10, y: 0 });
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeCloseTo(110);
  });

  it("names and initials", () => {
    expect(initials("Ann Marie Smith")).toBe("AS");
    expect(initials("Cher")).toBe("CH");
    expect(tableName({ label: "Paris", number: 3, kind: "round" })).toBe("Paris (3)");
    expect(tableName({ label: null, number: 3, kind: "round" })).toBe("Table 3");
  });
});

describe("editing", () => {
  it("numbers new tables and duplicates without guests", () => {
    let s = withTables(table("t1", 8));
    const t2 = createObject(s, "round", { x: 0, y: 0 }, "t2");
    expect(t2.number).toBe(2);
    s = assignSeat({ ...s, objects: { ...s.objects, t2 } }, "ann", "t1", 0);
    s = duplicateObject(s, "t1", "t3");
    expect(s.objects.t3.number).toBe(3);
    expect(Object.values(s.assignments).filter((a) => a.objectId === "t3")).toHaveLength(0);
  });

  it("swaps two seated guests and bumps someone when the mover had no seat", () => {
    let s = withTables(table("t1", 8));
    s = assignSeat(s, "ann", "t1", 0);
    s = assignSeat(s, "bob", "t1", 1);
    s = assignSeat(s, "ann", "t1", 1);
    expect(s.assignments.ann.seatIndex).toBe(1);
    expect(s.assignments.bob.seatIndex).toBe(0);
    s = assignSeat(s, "cat", "t1", 0);
    expect(s.assignments.cat.seatIndex).toBe(0);
    expect(s.assignments.bob).toBeUndefined();
  });

  it("seats a household together and reports who didn't fit", () => {
    let s = withTables(table("t1", 4));
    s = assignSeat(s, "x", "t1", 1);
    const r = assignToTable(s, ["a", "b", "c", "d"], "t1");
    expect(r.unplaced).toEqual(["d"]);
    expect(new Set(["a", "b", "c"].map((g) => r.state.assignments[g].seatIndex))).toEqual(
      new Set([0, 2, 3]),
    );
  });

  it("unseats guests in removed seats when a table shrinks, and when it's deleted", () => {
    let s = withTables(table("t1", 8));
    s = assignSeat(s, "a", "t1", 7);
    s = assignSeat(s, "b", "t1", 0);
    s = updateObject(s, "t1", { seatCount: 6 });
    expect(s.assignments.a).toBeUndefined();
    expect(s.objects.t1.width).toBe(tableSize("round", 6).width);
    s = deleteObject(s, "t1");
    expect(s.assignments).toEqual({});
  });

  it("diffs and merges changes for saving", () => {
    const before = assignSeat(withTables(table("t1", 8)), "a", "t1", 0);
    let after = updateObject(before, "t1", { x: 50 });
    after = unassign(after, ["a"]);
    after = assignSeat(after, "b", "t1", 2);
    const d = diffStates(before, after);
    expect(Object.keys(d.objects)).toEqual(["t1"]);
    expect(d.assignments).toEqual({ a: null, b: { guestId: "b", objectId: "t1", seatIndex: 2 } });

    const later = mergeChanges(d, {
      objects: {},
      assignments: { a: { guestId: "a", objectId: "t1", seatIndex: 5 } },
    });
    const p = toPayload(later);
    expect(p.unassign).toEqual([]);
    expect(p.assign.map((x) => x.guest_id).sort()).toEqual(["a", "b"]);
    expect(p.objects[0]).toMatchObject({ id: "t1", x: 50, seat_count: 8 });
  });
});

describe("rules", () => {
  it("flags broken rules, lone children, declined guests and missing seats", () => {
    let s = withTables(table("t1", 4), table("t2", 4));
    s = assignSeat(s, "ex1", "t1", 0);
    s = assignSeat(s, "ex2", "t1", 1);
    s = assignSeat(s, "pal1", "t1", 2);
    s = assignSeat(s, "pal2", "t2", 0);
    s = assignSeat(s, "kid", "t2", 1);
    s = assignSeat(s, "no", "t2", 2);
    const guests = new Map(
      [
        guest("ex1"),
        guest("ex2"),
        guest("pal1"),
        guest("pal2"),
        guest("kid", { ageGroup: "child", householdId: "fam" }),
        guest("mum", { householdId: "fam" }),
        guest("no", { rsvp: "declined" }),
        ...Array.from({ length: 5 }, (_, i) => guest(`extra${i}`)),
      ].map((g) => [g.id, g]),
    );
    const a = analyzeSeating(s, guests, [
      { guestA: "ex1", guestB: "ex2", type: "keep_apart" },
      { guestA: "pal1", guestB: "pal2", type: "keep_together" },
    ]);
    expect(a.byTable.t1.map((i) => i.type).sort()).toEqual(["keep_apart", "keep_together"]);
    expect(a.byTable.t2.map((i) => i.type).sort()).toEqual([
      "child_alone",
      "keep_together",
      "not_attending",
    ]);
    expect(a.totals).toMatchObject({ seats: 8, seated: 6, attending: 11, seatsShort: 3 });
  });
});

describe("auto-arrange", () => {
  it("keeps households together, respects keep-apart, never moves seated guests", () => {
    let s = withTables(table("t1", 4), table("t2", 4));
    s = assignSeat(s, "exA", "t1", 0);
    const guests = [
      guest("exA"),
      guest("exB"),
      guest("m1", { householdId: "fam", householdName: "Fam" }),
      guest("m2", { householdId: "fam", householdName: "Fam" }),
      guest("m3", { householdId: "fam", householdName: "Fam" }),
    ];
    const all = new Map(guests.map((g) => [g.id, g]));
    const r = autoArrange(s, guests, all, [{ guestA: "exA", guestB: "exB", type: "keep_apart" }]);
    expect(r.state.assignments.exA).toEqual(s.assignments.exA);
    expect(r.state.assignments.exB.objectId).toBe("t2");
    const famTables = new Set(["m1", "m2", "m3"].map((g) => r.state.assignments[g].objectId));
    expect(famTables.size).toBe(1);
    expect(r.unplaced).toEqual([]);
  });

  it("puts keep-together partners at the same table and reports overflow", () => {
    const s = withTables(table("t1", 2));
    const guests = [guest("a"), guest("b"), guest("c")];
    const r = autoArrange(s, guests, new Map(guests.map((g) => [g.id, g])), [
      { guestA: "a", guestB: "c", type: "keep_together" },
    ]);
    expect(r.state.assignments.a.objectId).toBe(r.state.assignments.c.objectId);
    expect(r.unplaced).toEqual(["b"]);
  });

  it("finds the snuggest run of neighbouring free seats", () => {
    // seats 0..7, free: 1,2 and 4,5,6
    expect(bestStartSeat([1, 2, 4, 5, 6], 8, 2)).toBe(1);
    expect(bestStartSeat([1, 2, 4, 5, 6], 8, 3)).toBe(4);
    // run wrapping around the end: 6,7,0
    expect(bestStartSeat([0, 6, 7], 8, 3)).toBe(6);
  });
});
