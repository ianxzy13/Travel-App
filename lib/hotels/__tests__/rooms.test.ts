import { describe, expect, it } from "vitest";
import { checkRoomRules, warningCountByRoom, type RuleInput } from "../room-rules";
import type { HotelRoomAssignmentRow, HotelRoomRow, HotelRoomTypeRow } from "../../database.types";

function makeRoom(overrides: Partial<HotelRoomRow> = {}): HotelRoomRow {
  return {
    id: "room-1",
    wedding_id: "w",
    hotel_id: "h",
    room_type_id: "rt-1",
    room_number: "101",
    name: null,
    capacity: null,
    floor: null,
    is_locked: false,
    notes: null,
    sort_order: 0,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

function makeRoomType(overrides: Partial<HotelRoomTypeRow> = {}): HotelRoomTypeRow {
  return {
    id: "rt-1",
    wedding_id: "w",
    hotel_id: "h",
    name: "Quad",
    beds: [{ kind: "double", count: 2 }],
    max_guests: 4,
    has_crib: false,
    accessible: false,
    price_per_night: "100" as unknown as number,
    count: 1,
    notes: null,
    sort_order: 0,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

function makeAssignment(guestId: string, roomId = "room-1"): HotelRoomAssignmentRow {
  return {
    id: `a-${guestId}`,
    wedding_id: "w",
    room_id: roomId,
    guest_id: guestId,
    check_in: null,
    check_out: null,
    needs_crib: false,
    created_at: "",
    updated_at: "",
  };
}

function makeGuest(id: string, householdId: string, ageGroup = "adult") {
  return { id, name: `Guest ${id}`, householdId, ageGroup, accessibility: null };
}

describe("checkRoomRules", () => {
  it("detects over capacity", () => {
    const rt = makeRoomType({ max_guests: 2 });
    const input: RuleInput = {
      rooms: [makeRoom()],
      roomTypes: new Map([["rt-1", rt]]),
      assignments: [makeAssignment("g1"), makeAssignment("g2"), makeAssignment("g3")],
      guests: new Map([
        ["g1", makeGuest("g1", "h1")],
        ["g2", makeGuest("g2", "h1")],
        ["g3", makeGuest("g3", "h1")],
      ]),
      relationships: [],
      attendingGuestIds: new Set(["g1", "g2", "g3"]),
    };
    const warnings = checkRoomRules(input);
    const kinds = warnings.map((w) => w.kind);
    expect(kinds).toContain("over_capacity");
  });

  it("detects child alone without adults", () => {
    const input: RuleInput = {
      rooms: [makeRoom()],
      roomTypes: new Map([["rt-1", makeRoomType()]]),
      assignments: [makeAssignment("c1"), makeAssignment("c2")],
      guests: new Map([
        ["c1", makeGuest("c1", "h1", "child")],
        ["c2", makeGuest("c2", "h1", "infant")],
      ]),
      relationships: [],
      attendingGuestIds: new Set(["c1", "c2"]),
    };
    const warnings = checkRoomRules(input);
    expect(warnings.some((w) => w.kind === "child_alone")).toBe(true);
  });

  it("detects stranger pair for unconnected households", () => {
    const input: RuleInput = {
      rooms: [makeRoom()],
      roomTypes: new Map([["rt-1", makeRoomType()]]),
      assignments: [makeAssignment("g1"), makeAssignment("g2")],
      guests: new Map([
        ["g1", makeGuest("g1", "h1")],
        ["g2", makeGuest("g2", "h2")],
      ]),
      relationships: [],
      attendingGuestIds: new Set(["g1", "g2"]),
    };
    const warnings = checkRoomRules(input);
    expect(warnings.some((w) => w.kind === "stranger_pair")).toBe(true);
  });

  it("does not fire stranger_pair when guests are keep_together", () => {
    const input: RuleInput = {
      rooms: [makeRoom()],
      roomTypes: new Map([["rt-1", makeRoomType()]]),
      assignments: [makeAssignment("g1"), makeAssignment("g2")],
      guests: new Map([
        ["g1", makeGuest("g1", "h1")],
        ["g2", makeGuest("g2", "h2")],
      ]),
      relationships: [{ guestA: "g1", guestB: "g2", type: "keep_together" }],
      attendingGuestIds: new Set(["g1", "g2"]),
    };
    const warnings = checkRoomRules(input);
    expect(warnings.some((w) => w.kind === "stranger_pair")).toBe(false);
  });

  it("stranger_pair can be filtered out of warning counts", () => {
    const input: RuleInput = {
      rooms: [makeRoom()],
      roomTypes: new Map([["rt-1", makeRoomType()]]),
      assignments: [makeAssignment("g1"), makeAssignment("g2")],
      guests: new Map([
        ["g1", makeGuest("g1", "h1")],
        ["g2", makeGuest("g2", "h2")],
      ]),
      relationships: [],
      attendingGuestIds: new Set(["g1", "g2"]),
    };
    const all = checkRoomRules(input);
    const withStranger = warningCountByRoom(all);
    const withoutStranger = warningCountByRoom(all.filter((w) => w.kind !== "stranger_pair"));

    expect(withStranger.get("room-1") ?? 0).toBeGreaterThan(0);
    expect(withoutStranger.get("room-1") ?? 0).toBe(0);
  });

  it("detects guests without a room", () => {
    const input: RuleInput = {
      rooms: [makeRoom()],
      roomTypes: new Map([["rt-1", makeRoomType()]]),
      assignments: [makeAssignment("g1")],
      guests: new Map([
        ["g1", makeGuest("g1", "h1")],
        ["g2", makeGuest("g2", "h1")],
      ]),
      relationships: [],
      attendingGuestIds: new Set(["g1", "g2"]),
    };
    const warnings = checkRoomRules(input);
    expect(warnings.some((w) => w.kind === "no_room" && w.guestIds?.includes("g2"))).toBe(true);
  });

  it("detects keep-apart violations", () => {
    const input: RuleInput = {
      rooms: [makeRoom()],
      roomTypes: new Map([["rt-1", makeRoomType()]]),
      assignments: [makeAssignment("g1"), makeAssignment("g2")],
      guests: new Map([
        ["g1", makeGuest("g1", "h1")],
        ["g2", makeGuest("g2", "h1")],
      ]),
      relationships: [{ guestA: "g1", guestB: "g2", type: "keep_apart" }],
      attendingGuestIds: new Set(["g1", "g2"]),
    };
    const warnings = checkRoomRules(input);
    expect(warnings.some((w) => w.kind === "keep_apart")).toBe(true);
  });
});

describe("RS1 room rules", () => {
  const base = (over: Partial<RuleInput> = {}): RuleInput => ({
    rooms: [makeRoom()],
    roomTypes: new Map([["rt-1", makeRoomType()]]),
    assignments: [],
    guests: new Map(),
    relationships: [],
    attendingGuestIds: new Set(),
    ...over,
  });
  const people = (n: number) =>
    Array.from({ length: n }, (_, i) => `g${i}`).map((id) => makeGuest(id, "h1"));

  it("room capacity overrides the room type", () => {
    const ps = people(5);
    const input = base({
      rooms: [makeRoom({ capacity: 6 })],
      roomTypes: new Map([["rt-1", makeRoomType({ max_guests: 4, beds: [] })]]),
      assignments: ps.map((p) => makeAssignment(p.id)),
      guests: new Map(ps.map((p) => [p.id, p])),
    });
    expect(checkRoomRules(input).map((w) => w.kind)).not.toContain("over_capacity");
  });

  it("warns when people outnumber beds (sofa bed sleeps 2)", () => {
    const ps = people(5);
    const beds = [
      { kind: "double" as const, count: 1 },
      { kind: "sofa_bed" as const, count: 1 },
    ];
    const input = base({
      rooms: [makeRoom({ capacity: 6 })],
      roomTypes: new Map([["rt-1", makeRoomType({ beds })]]),
      assignments: ps.map((p) => makeAssignment(p.id)),
      guests: new Map(ps.map((p) => [p.id, p])),
    });
    expect(checkRoomRules(input).map((w) => w.kind)).toContain("over_beds");

    const four = { ...input, assignments: input.assignments.slice(0, 4) };
    expect(checkRoomRules(four).map((w) => w.kind)).not.toContain("over_beds");
  });

  it("skips the bed check when no beds are filled in", () => {
    const ps = people(4);
    const input = base({
      roomTypes: new Map([["rt-1", makeRoomType({ beds: [] })]]),
      assignments: ps.map((p) => makeAssignment(p.id)),
      guests: new Map(ps.map((p) => [p.id, p])),
    });
    expect(checkRoomRules(input).map((w) => w.kind)).not.toContain("over_beds");
  });

  it("flags declined guests who still have a room", () => {
    const ps = people(2);
    const input = base({
      assignments: ps.map((p) => makeAssignment(p.id)),
      guests: new Map(ps.map((p) => [p.id, p])),
      declinedGuestIds: new Set(["g1"]),
    });
    const w = checkRoomRules(input).find((x) => x.kind === "declined_in_room");
    expect(w?.guestIds).toEqual(["g1"]);
  });

  it("uses the room nickname in messages", () => {
    const ps = people(3);
    const input = base({
      rooms: [makeRoom({ name: "Girls' room", capacity: 2 })],
      assignments: ps.map((p) => makeAssignment(p.id)),
      guests: new Map(ps.map((p) => [p.id, p])),
    });
    const w = checkRoomRules(input).find((x) => x.kind === "over_capacity");
    expect(w?.message).toContain("Girls' room");
  });
});

describe("roommates' dates", () => {
  const booked = { from: "2027-03-05", to: "2027-03-09" };
  const input = (own: Record<string, { from: string; to: string }>): RuleInput => ({
    rooms: [makeRoom()],
    roomTypes: new Map([["rt-1", makeRoomType()]]),
    assignments: [makeAssignment("g1"), makeAssignment("g2")],
    guests: new Map([
      ["g1", makeGuest("g1", "h1")],
      ["g2", makeGuest("g2", "h1")],
    ]),
    relationships: [],
    attendingGuestIds: new Set(["g1", "g2"]),
    stayOf: (id) => own[id] ?? booked,
  });

  it("is quiet when everyone stays the booked dates", () => {
    expect(checkRoomRules(input({})).some((w) => w.kind === "night_mismatch")).toBe(false);
  });

  it("warns and counts nights someone is alone", () => {
    const w = checkRoomRules(input({ g1: { from: "2027-03-03", to: "2027-03-09" } })).find(
      (x) => x.kind === "night_mismatch",
    );
    expect(w?.aloneNights).toBe(2);
  });
});
