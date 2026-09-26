import { describe, expect, it } from "vitest";
import { endTime, fromMinutes, overlaps, shiftFrom, sortByTime, toMinutes } from "@/lib/schedule/time";
import { SUGGESTIONS, detectDone, dueState, missingSuggestions, phaseOf, suggestionDue } from "../timeline";

describe("suggested timeline", () => {
  const wedding = "2027-06-12";
  it("dates tasks back from the wedding", () => {
    const venue = SUGGESTIONS.find((s) => s.key === "book-venue")!;
    expect(suggestionDue(venue, wedding, "2026-01-01")).toBe("2026-06-12");
    const thanks = SUGGESTIONS.find((s) => s.key === "thank-you")!;
    expect(suggestionDue(thanks, wedding, "2026-01-01")).toBe("2027-07-03");
  });
  it("moves things that should already be done to today", () => {
    const venue = SUGGESTIONS.find((s) => s.key === "book-venue")!;
    expect(suggestionDue(venue, wedding, "2027-03-01")).toBe("2027-03-01");
  });
  it("only adds what's missing, in date order", () => {
    const rows = missingSuggestions(new Set(["set-budget"]), wedding, "2026-01-01");
    expect(rows.some((r) => r.suggestion_key === "set-budget")).toBe(false);
    expect(rows).toHaveLength(SUGGESTIONS.length - 1);
    const orders = rows.map((r) => r.sort_order);
    const dates = rows.map((r) => r.due_date);
    // sort order follows due dates
    const byOrder = [...rows].sort((a, b) => a.sort_order - b.sort_order).map((r) => r.due_date);
    expect(byOrder).toEqual([...dates].sort());
    expect(new Set(orders).size).toBe(orders.length);
  });
  it("spreads catch-up tasks over the next weeks when starting late", () => {
    const rows = missingSuggestions(new Set(), wedding, "2027-01-01");
    const dueToday = rows.filter((r) => r.due_date === "2027-01-01");
    expect(dueToday).toHaveLength(1);
    const catchUp = rows.filter((r) => r.due_date <= "2027-01-29");
    expect(catchUp.length).toBeGreaterThan(20);
    // the sort value still follows the due dates, and nothing moves past the wedding
    const byOrder = [...rows].sort((a, b) => a.sort_order - b.sort_order).map((r) => r.due_date);
    expect(byOrder).toEqual(rows.map((r) => r.due_date).sort());
    expect(rows.every((r) => r.suggestion_key === "thank-you" || r.suggestion_key === "reviews" || r.due_date <= wedding)).toBe(true);
  });
  it("keys are unique", () => {
    expect(new Set(SUGGESTIONS.map((s) => s.key)).size).toBe(SUGGESTIONS.length);
  });
});

describe("phaseOf / dueState", () => {
  it("groups by time before the wedding", () => {
    const w = "2027-06-12";
    expect(phaseOf("2026-05-01", w)).toBe("12m");
    expect(phaseOf("2026-10-01", w)).toBe("6m");
    expect(phaseOf("2027-05-20", w)).toBe("month");
    expect(phaseOf("2027-06-10", w)).toBe("week");
    expect(phaseOf("2027-06-12", w)).toBe("week");
    expect(phaseOf("2027-07-01", w)).toBe("after");
    expect(phaseOf(null, w)).toBe("none");
  });
  it("marks overdue, today and soon", () => {
    expect(dueState("2026-09-20", "2026-09-26")).toBe("overdue");
    expect(dueState("2026-09-26", "2026-09-26")).toBe("today");
    expect(dueState("2026-10-01", "2026-09-26")).toBe("soon");
    expect(dueState("2026-12-01", "2026-09-26")).toBe("later");
    expect(dueState("2026-09-20", "2026-09-26", true)).toBeNull();
  });
});

describe("detectDone", () => {
  it("recognises finished work elsewhere in the app", () => {
    const done = detectDone({
      budgetSet: true,
      guests: 0,
      pins: 3,
      venueBooked: true,
      websitePublished: false,
      roomBlockConfirmed: false,
      invitesSent: false,
      scheduleItems: 0,
      bookedVendorCategories: ["photography"],
      seatingDone: false,
    });
    expect(Object.keys(done).sort()).toEqual(["book-venue", "inspiration", "photographer", "set-budget"]);
  });
});

describe("schedule times", () => {
  it("converts and wraps", () => {
    expect(toMinutes("15:30:00")).toBe(930);
    expect(fromMinutes(930)).toBe("15:30");
    expect(fromMinutes(1450)).toBe("00:10");
    expect(endTime("23:30", 60)).toBe("00:30");
    expect(endTime("10:00", null)).toBeNull();
  });
  const items = [
    { id: "b", start_time: "15:00:00", duration_min: 45 },
    { id: "a", start_time: "14:30:00", duration_min: 30 },
    { id: "c", start_time: "15:30:00", duration_min: 60 },
    { id: "d", start_time: "16:40:00", duration_min: null },
  ];
  it("sorts and finds overlaps", () => {
    expect(sortByTime(items).map((i) => i.id)).toEqual(["a", "b", "c", "d"]);
    // c starts at 15:30 while b (15:00–15:45) is still going
    expect([...overlaps(items)]).toEqual([["c", "b"]]);
  });
  it("shifts an item and everything after it", () => {
    expect(shiftFrom(items, "b", 15)).toEqual([
      { id: "b", start_time: "15:15" },
      { id: "c", start_time: "15:45" },
      { id: "d", start_time: "16:55" },
    ]);
  });
});
