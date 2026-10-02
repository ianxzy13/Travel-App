import { describe, expect, it } from "vitest";
import { answerKey, findMissing, initialFormState, rsvpGuestName, toPayload } from "../form";
import { eventTotals, householdReply, mealCounts } from "../stats";
import { normalizeCode, rsvpErrorMessage, type RsvpData } from "../types";

const data: RsvpData = {
  wedding: {
    id: "w",
    slug: "ian-and-maria",
    partner_a_name: "Ian",
    partner_b_name: "Maria",
    wedding_date: "2027-06-12",
    location: null,
    accent: "rose",
    rsvp_deadline: null,
    rsvp_contact: null,
    rsvp_ask_song: true,
    rsvp_ask_travel: false,
    deadline_passed: false,
    destination_airport: null,
  },
  household: {
    id: "h",
    name: "The Smiths",
    code: "K7P2QX",
    song_request: null,
    message: null,
    responded_at: null,
  },
  guests: [
    {
      id: "ann",
      first_name: "Ann",
      last_name: "Smith",
      plus_one_of: null,
      age_group: "adult",
      dietary: null,
    },
    {
      id: "p1",
      first_name: "",
      last_name: "",
      plus_one_of: "ann",
      age_group: "adult",
      dietary: null,
    },
  ],
  events: [
    {
      id: "cer",
      name: "Ceremony",
      event_date: null,
      start_time: null,
      end_time: null,
      venue_name: null,
      address: null,
      dress_code: null,
      description: null,
      meal_choice: false,
    },
    {
      id: "rec",
      name: "Reception",
      event_date: null,
      start_time: null,
      end_time: null,
      venue_name: null,
      address: null,
      dress_code: null,
      description: null,
      meal_choice: true,
    },
  ],
  invites: [
    { guest_id: "ann", event_id: "cer" },
    { guest_id: "ann", event_id: "rec" },
    { guest_id: "p1", event_id: "rec" },
  ],
  responses: [{ guest_id: "ann", event_id: "cer", status: "attending", meal_option_id: null }],
  meal_options: [{ id: "fish", name: "Fish", description: null }],
  hotels: [],
  travel: null,
};

describe("RSVP form", () => {
  it("starts from previous answers", () => {
    const s = initialFormState(data);
    expect(s.answers[answerKey("ann", "cer")]).toEqual({ status: "attending", mealOptionId: null });
    expect(s.answers[answerKey("p1", "rec")]).toEqual({ status: null, mealOptionId: null });
  });

  it("requires an answer for every invitation and a meal when attending", () => {
    const s = initialFormState(data);
    expect(findMissing(data, s).map((m) => `${m.guestId}:${m.eventId}:${m.kind}`)).toEqual([
      "ann:rec:status",
      "p1:rec:status",
    ]);
    s.answers[answerKey("ann", "rec")] = { status: "attending", mealOptionId: null };
    s.answers[answerKey("p1", "rec")] = { status: "declined", mealOptionId: null };
    expect(findMissing(data, s)).toEqual([{ guestId: "ann", eventId: "rec", kind: "meal" }]);
    s.answers[answerKey("ann", "rec")].mealOptionId = "fish";
    expect(findMissing(data, s)).toEqual([]);
  });

  it("builds the payload: meals only when attending, names only for plus-ones", () => {
    const s = initialFormState(data);
    s.answers[answerKey("ann", "rec")] = { status: "attending", mealOptionId: "fish" };
    s.answers[answerKey("p1", "rec")] = { status: "declined", mealOptionId: "fish" };
    s.people.p1 = { firstName: "Tom", lastName: "Jones", dietary: "vegan" };
    const p = toPayload(data, s);
    expect(p.responses).toEqual([
      { guest_id: "ann", event_id: "cer", status: "attending", meal_option_id: null },
      { guest_id: "ann", event_id: "rec", status: "attending", meal_option_id: "fish" },
      { guest_id: "p1", event_id: "rec", status: "declined", meal_option_id: null },
    ]);
    expect(p.guests).toEqual([
      { id: "ann", dietary: "" },
      { id: "p1", dietary: "vegan", first_name: "Tom", last_name: "Jones" },
    ]);
  });

  it("names unnamed plus-ones after their host", () => {
    expect(rsvpGuestName(data, "p1")).toBe("Ann's guest");
  });

  it("normalises typed codes and translates errors", () => {
    expect(normalizeCode(" k7p-2qx ")).toBe("K7P2QX");
    expect(rsvpErrorMessage("deadline_passed")).toMatch(/deadline/);
    expect(rsvpErrorMessage("boom")).toMatch(/try again/);
  });
});

describe("RSVP stats", () => {
  const invites = [
    { guest_id: "a", event_id: "e1" },
    { guest_id: "b", event_id: "e1" },
    { guest_id: "c", event_id: "e1" },
    { guest_id: "a", event_id: "e2" },
  ];
  const responses = [
    { guest_id: "a", event_id: "e1", status: "attending" as const, meal_option_id: "m1" },
    { guest_id: "b", event_id: "e1", status: "declined" as const, meal_option_id: null },
    { guest_id: "a", event_id: "e2", status: "attending" as const, meal_option_id: null },
    // an answer without an invitation is ignored
    { guest_id: "z", event_id: "e1", status: "attending" as const, meal_option_id: null },
  ];

  it("counts attending / declined / waiting per event", () => {
    expect(eventTotals(["e1", "e2"], invites, responses)).toEqual({
      e1: { invited: 3, attending: 1, declined: 1, waiting: 1 },
      e2: { invited: 1, attending: 1, declined: 0, waiting: 0 },
    });
  });

  it("counts meals of attending guests only", () => {
    expect(mealCounts(["e1", "e2"], responses)).toEqual({
      e1: { byMeal: { m1: 1 }, noChoice: 1 },
      e2: { byMeal: {}, noChoice: 1 },
    });
  });

  it("summarises a household's reply", () => {
    expect(householdReply(["a", "b"], invites, responses)).toEqual({
      status: "replied",
      attending: 1,
      declined: 1,
    });
    expect(householdReply(["a", "c"], invites, responses)).toMatchObject({
      status: "partial",
      attending: 1,
    });
    expect(householdReply(["c"], invites, responses)).toMatchObject({ status: "waiting" });
    expect(householdReply(["x"], invites, responses)).toMatchObject({ status: "not_invited" });
  });
});
