import { describe, expect, it } from "vitest";
import { replyGuests } from "../reply-summary";
import type { Translations } from "@/lib/database.types";

const input = {
  guests: [
    { id: "g1", first_name: "Sarah", last_name: "Mitchell", dietary: " Vegetarian " },
    { id: "g2", first_name: "Emma", last_name: "Mitchell", dietary: "" },
  ],
  events: [
    { id: "dinner", name: "Dinner", sort_order: 2, translations: { sl: { name: "Večerja" } } },
    { id: "cer", name: "Ceremony", sort_order: 1, translations: {} as Translations },
    { id: "brunch", name: "Brunch", sort_order: 3, translations: {} as Translations },
  ],
  meals: [{ id: "m1", name: "Fish", translations: { sl: { name: "Riba" } } }],
  invites: [
    { guest_id: "g1", event_id: "cer" },
    { guest_id: "g1", event_id: "dinner" },
    { guest_id: "g2", event_id: "cer" },
  ],
  responses: [
    { guest_id: "g1", event_id: "cer", status: "attending" as const, meal_option_id: null },
    { guest_id: "g1", event_id: "dinner", status: "attending" as const, meal_option_id: "m1" },
    { guest_id: "g2", event_id: "cer", status: "declined" as const, meal_option_id: null },
  ],
};

describe("replyGuests", () => {
  it("lists each guest's invited events in order, with meals and dietary needs", () => {
    const { guests, eventCount } = replyGuests(input, "en");
    expect(eventCount).toBe(2);
    expect(guests[0]).toEqual({
      name: "Sarah Mitchell",
      dietary: "Vegetarian",
      events: [
        { name: "Ceremony", status: "attending", meal: null },
        { name: "Dinner", status: "attending", meal: "Fish" },
      ],
    });
    expect(guests[1]).toEqual({
      name: "Emma Mitchell",
      dietary: null,
      events: [{ name: "Ceremony", status: "declined", meal: null }],
    });
  });

  it("uses the reader's language for event and meal names", () => {
    const shown = (t: string) => (t === "Ceremony" ? "Poročni obred" : t);
    const { guests } = replyGuests(input, "sl", shown);
    expect(guests[0].events.map((e) => [e.name, e.meal])).toEqual([
      ["Poročni obred", null],
      ["Večerja", "Riba"],
    ]);
  });

  it("shows invited events without an answer as unanswered", () => {
    const { guests } = replyGuests({ ...input, responses: [] }, "en");
    expect(guests[1].events).toEqual([{ name: "Ceremony", status: null, meal: null }]);
  });
});
