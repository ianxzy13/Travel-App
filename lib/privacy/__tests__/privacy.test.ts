import { describe, expect, it, vi } from "vitest";
import { initialFormState, toPayload } from "@/lib/rsvp/form";

vi.mock("server-only", () => ({}));

describe("retention cutoff helpers", () => {
  it("retentionCutoff returns a date RETENTION_MONTHS ago", async () => {
    const { retentionCutoff, RETENTION_MONTHS } = await import("../retention");
    const cutoff = retentionCutoff();
    const d = new Date(cutoff);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30);
    expect(diffMonths).toBeGreaterThan(RETENTION_MONTHS - 1);
    expect(diffMonths).toBeLessThan(RETENTION_MONTHS + 1);
  });

  it("warningCutoff is WARNING_DAYS ahead of retentionCutoff", async () => {
    const { retentionCutoff, warningCutoff, WARNING_DAYS } = await import("../retention");
    const rc = new Date(retentionCutoff());
    const wc = new Date(warningCutoff());
    const diffDays = (wc.getTime() - rc.getTime()) / (1000 * 60 * 60 * 24);
    expect(Math.round(diffDays)).toBe(WARNING_DAYS);
  });

  it("returns ISO date strings (YYYY-MM-DD)", async () => {
    const { retentionCutoff, warningCutoff } = await import("../retention");
    expect(retentionCutoff()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(warningCutoff()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("consent stripping in toPayload", () => {
  const makeData = () => ({
    wedding: {
      id: "w", slug: "test", partner_a_name: "A", partner_b_name: "B",
      wedding_date: null, location: null, accent: "rose" as const,
      rsvp_deadline: null, rsvp_contact: null, rsvp_ask_song: false,
      rsvp_ask_travel: false, deadline_passed: false, destination_airport: null,
    },
    household: { id: "h", name: "H", code: "ABC123", song_request: null, message: null, responded_at: null },
    guests: [
      { id: "g1", first_name: "Test", last_name: "User", plus_one_of: null, age_group: "adult" as const, dietary: null, dietary_consent: false, wants_hotel_room: null, needs_crib: false, room_pref_share: null, room_pref_avoid: null },
    ],
    events: [] as never[],
    invites: [] as never[],
    responses: [] as never[],
    meal_options: [] as never[],
    hotels: [] as never[],
    room_assignments: [] as never[],
    travel: null,
  });

  it("strips dietary when consent is false", () => {
    const data = makeData();
    const state = initialFormState(data);
    state.people.g1.dietary = "Vegan";
    state.people.g1.dietaryConsent = false;

    const payload = toPayload(data, state);
    expect(payload.guests[0].dietary).toBe("");
    expect(payload.guests[0].dietary_consent).toBe(false);
  });

  it("keeps dietary when consent is true", () => {
    const data = makeData();
    const state = initialFormState(data);
    state.people.g1.dietary = "Vegan";
    state.people.g1.dietaryConsent = true;

    const payload = toPayload(data, state);
    expect(payload.guests[0].dietary).toBe("Vegan");
    expect(payload.guests[0].dietary_consent).toBe(true);
  });
});
