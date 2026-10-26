import { describe, expect, it } from "vitest";
import {
  bedSpots,
  friendGroup,
  matchesRsvpFilter,
  roomCapacity,
  roomLabels,
  roomTitle,
  rsvpStatusOf,
} from "../room-sharing";

describe("bedSpots", () => {
  it("counts doubles, sofa beds and bunks as 2 and singles as 1", () => {
    expect(
      bedSpots([
        { kind: "double", count: 1 },
        { kind: "single", count: 2 },
        { kind: "sofa_bed", count: 1 },
        { kind: "bunk", count: 1 },
      ]),
    ).toBe(8);
  });
  it("returns null when no beds are set", () => {
    expect(bedSpots([])).toBeNull();
    expect(bedSpots(null)).toBeNull();
  });
});

describe("roomCapacity / roomTitle", () => {
  it("prefers the room's own capacity", () => {
    expect(roomCapacity({ capacity: 6 }, { max_guests: 4 })).toBe(6);
    expect(roomCapacity({ capacity: null }, { max_guests: 4 })).toBe(4);
    expect(roomCapacity({ capacity: null }, null)).toBe(99);
  });
  it("shows the nickname, else the number", () => {
    expect(roomTitle({ name: "Cousins", room_number: "101" })).toBe("Cousins");
    expect(roomTitle({ name: "  ", room_number: "101" })).toBe("101");
  });
});

describe("roomLabels", () => {
  it("counts up numbers and keeps zero padding", () => {
    expect(roomLabels("101", 3)).toEqual(["101", "102", "103"]);
    expect(roomLabels("A09", 2)).toEqual(["A09", "A10"]);
  });
  it("counts up letters", () => {
    expect(roomLabels("Room A", 3)).toEqual(["Room A", "Room B", "Room C"]);
    expect(roomLabels("Y", 3)).toEqual(["Y", "Z", "AA"]);
  });
  it("numbers plain names", () => {
    expect(roomLabels("Cabin", 2)).toEqual(["Cabin 1", "Cabin 2"]);
  });
  it("skips labels already in use", () => {
    expect(roomLabels("101", 2, ["101", "103"])).toEqual(["102", "104"]);
  });
});

describe("friendGroup", () => {
  const tags = new Map([
    ["t-work", { name: "Work", color: "sky" as const }],
    ["t-uni", { name: "Uni friends", color: "rose" as const }],
  ]);
  it("uses the first tag alphabetically", () => {
    const g = friendGroup({ householdId: "h", householdName: "Novak", tagIds: ["t-work", "t-uni"] }, tags);
    expect(g).toEqual({ key: "tag:t-uni", label: "Uni friends", color: "rose" });
  });
  it("falls back to the household", () => {
    const g = friendGroup({ householdId: "h", householdName: "Novak", tagIds: ["gone"] }, tags);
    expect(g).toEqual({ key: "hh:h", label: "Novak", color: null });
  });
});

describe("RSVP filter", () => {
  it("planning view hides only declined guests", () => {
    expect(matchesRsvpFilter("attending", "planning")).toBe(true);
    expect(matchesRsvpFilter("not_replied", "planning")).toBe(true);
    expect(matchesRsvpFilter("declined", "planning")).toBe(false);
    expect(matchesRsvpFilter("declined", "everyone")).toBe(true);
    expect(matchesRsvpFilter("attending", "not_replied")).toBe(false);
  });
  it("attending on any event counts as attending", () => {
    expect(rsvpStatusOf(["declined", "attending"])).toBe("attending");
    expect(rsvpStatusOf(["declined"])).toBe("declined");
    expect(rsvpStatusOf([])).toBe("not_replied");
  });
});
