import { describe, expect, it } from "vitest";
import {
  addDays,
  aloneNights,
  effectiveStay,
  extraRoomNights,
  nightList,
  nightTable,
  nightsBetween,
  normaliseStay,
  roomsNeeded,
  stayDiff,
  staySummary,
} from "../nights";

const booked = { from: "2027-03-05", to: "2027-03-09" };

describe("nightsBetween", () => {
  it("counts nights", () => {
    expect(nightsBetween("2027-03-05", "2027-03-09")).toBe(4);
  });
  it("crosses month and year ends", () => {
    expect(nightsBetween("2027-02-27", "2027-03-02")).toBe(3);
    expect(nightsBetween("2028-02-28", "2028-03-01")).toBe(2); // leap year
    expect(nightsBetween("2026-12-30", "2027-01-02")).toBe(3);
  });
  it("is 0 for missing dates or departure before arrival", () => {
    expect(nightsBetween(null, "2027-03-09")).toBe(0);
    expect(nightsBetween("2027-03-05", undefined)).toBe(0);
    expect(nightsBetween("2027-03-09", "2027-03-05")).toBe(0);
    expect(nightsBetween("2027-03-05", "2027-03-05")).toBe(0);
    expect(nightsBetween("nonsense", "2027-03-05")).toBe(0);
  });
});

describe("addDays / nightList", () => {
  it("adds across month ends", () => {
    expect(addDays("2027-01-31", 1)).toBe("2027-02-01");
    expect(addDays("2027-03-01", -1)).toBe("2027-02-28");
  });
  it("lists every night", () => {
    expect(nightList("2027-02-27", "2027-03-02")).toEqual([
      "2027-02-27",
      "2027-02-28",
      "2027-03-01",
    ]);
    expect(nightList("2027-03-02", "2027-02-27")).toEqual([]);
  });
});

describe("effectiveStay", () => {
  it("falls back to the booked dates", () => {
    expect(effectiveStay({ from: null, to: null }, booked)).toEqual(booked);
    expect(effectiveStay({ from: "2027-03-03", to: null }, booked)).toEqual({
      from: "2027-03-03",
      to: "2027-03-09",
    });
  });
  it("is null when nothing adds up", () => {
    expect(effectiveStay({ from: null, to: null }, null)).toBeNull();
    expect(effectiveStay({ from: null, to: "2027-03-04" }, booked)).toBeNull();
  });
  it("normalise drops dates equal to the booking", () => {
    expect(normaliseStay({ from: "2027-03-05", to: "2027-03-11" }, booked)).toEqual({
      from: null,
      to: "2027-03-11",
    });
  });
});

describe("stayDiff", () => {
  it("finds extra and skipped nights", () => {
    expect(stayDiff({ from: "2027-03-03", to: "2027-03-11" }, booked)).toMatchObject({
      early: 2,
      late: 2,
      same: false,
    });
    expect(stayDiff({ from: "2027-03-06", to: "2027-03-08" }, booked)).toMatchObject({
      skipStart: 1,
      skipEnd: 1,
    });
    expect(stayDiff(booked, booked).same).toBe(true);
  });
});

describe("rooms and nights", () => {
  it("rounds rooms up", () => {
    expect(roomsNeeded(9, 4)).toBe(3);
    expect(roomsNeeded(0, 4)).toBe(0);
    expect(roomsNeeded(3, 0)).toBe(3);
  });

  it("builds the per-night table with quiet nights", () => {
    const rows = nightTable(
      [
        { from: "2027-03-01", to: "2027-03-02" },
        { from: "2027-03-05", to: "2027-03-09" },
        { from: "2027-03-05", to: "2027-03-10" },
        null,
      ],
      4,
      booked,
    );
    expect(rows.map((r) => r.date)).toEqual([
      "2027-03-01",
      "2027-03-02",
      "2027-03-03",
      "2027-03-04",
      "2027-03-05",
      "2027-03-06",
      "2027-03-07",
      "2027-03-08",
      "2027-03-09",
    ]);
    expect(rows[1]).toMatchObject({ guests: 0, rooms: 0, booked: false });
    expect(rows[4]).toMatchObject({ guests: 2, rooms: 1, booked: true });
    expect(rows[8]).toMatchObject({ guests: 1, rooms: 1, booked: false });
    expect(extraRoomNights(rows)).toBe(2);
  });

  it("counts nights someone is alone in a shared room", () => {
    expect(
      aloneNights([
        { from: "2027-03-03", to: "2027-03-09" },
        { from: "2027-03-05", to: "2027-03-09" },
      ]),
    ).toBe(2);
    expect(aloneNights([booked])).toBe(0);
  });
});

describe("staySummary", () => {
  it("lists early, late and shorter stays", () => {
    const s = staySummary(
      [
        { id: "a", name: "Ana", stay: { from: "2027-03-03", to: "2027-03-09" } },
        { id: "m", name: "Marko", stay: { from: "2027-03-03", to: "2027-03-09" } },
        { id: "p", name: "Petra", stay: { from: "2027-03-05", to: "2027-03-11" } },
        { id: "j", name: "Jan", stay: { from: "2027-03-06", to: "2027-03-09" } },
        { id: "x", name: "No dates", stay: null },
      ],
      booked,
      4,
    );
    expect(s.guests).toBe(4);
    expect(s.rooms).toBe(1);
    expect(s.early.map((e) => [e.name, e.nights])).toEqual([
      ["Ana", 2],
      ["Marko", 2],
    ]);
    expect(s.late).toEqual([{ id: "p", name: "Petra", date: "2027-03-11", nights: 2 }]);
    expect(s.shorter.map((e) => e.name)).toEqual(["Jan"]);
    expect(s.extraRoomNights).toBe(4); // 2 early nights + 2 late nights, one room each
  });

  it("works without a booking", () => {
    const s = staySummary([{ id: "a", name: "Ana", stay: null }], null, 4);
    expect(s).toMatchObject({ guests: 0, rooms: 0, early: [], nights: [] });
  });
});
