import "server-only";
import type { Translations } from "@/lib/database.types";
import type { EmailKind, EmailStatus, WeddingRow } from "@/lib/database.types";
import { guestDisplayName } from "@/lib/guests/model";
import { fetchAll } from "@/lib/supabase/fetch-all";
import type { createClient } from "@/lib/supabase/server";
import {
  eventTotals,
  householdReply,
  mealCounts,
  type EventTotals,
  type HouseholdReply,
  type MealCounts,
} from "./stats";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type DashboardHousehold = {
  id: string;
  name: string;
  code: string;
  respondedAt: string | null;
  songRequest: string | null;
  message: string | null;
  guests: { id: string; name: string; email: string | null; isPlusOne: boolean }[];
  lastEmail: {
    kind: EmailKind;
    status: EmailStatus;
    sentAt: string;
    openedAt: string | null;
  } | null;
  reply: HouseholdReply;
};

export type RsvpDashboardData = {
  households: DashboardHousehold[];
  events: { id: string; name: string; mealChoice: boolean }[];
  mealOptions: {
    id: string;
    name: string;
    description: string | null;
    translations: Translations;
  }[];
  totals: Record<string, EventTotals>;
  meals: Record<string, MealCounts>;
};

/** Everything the /app/rsvp page shows, computed on the server. */
export async function loadRsvpDashboard(
  sb: Supabase,
  wedding: WeddingRow,
): Promise<RsvpDashboardData> {
  const wid = wedding.id;
  const [households, guests, invites, responses, events, mealOptions, emails] = await Promise.all([
    fetchAll((f, t) =>
      sb
        .from("households")
        .select("id, name, rsvp_code, rsvp_responded_at, rsvp_song_request, rsvp_message")
        .eq("wedding_id", wid)
        .order("name")
        .range(f, t),
    ),
    fetchAll((f, t) =>
      sb
        .from("guests")
        .select("id, household_id, first_name, last_name, email, plus_one_of")
        .eq("wedding_id", wid)
        .order("id")
        .range(f, t),
    ),
    fetchAll((f, t) =>
      sb
        .from("guest_event_invites")
        .select("guest_id, event_id")
        .eq("wedding_id", wid)
        .order("id")
        .range(f, t),
    ),
    fetchAll((f, t) =>
      sb
        .from("rsvp_responses")
        .select("guest_id, event_id, status, meal_option_id")
        .eq("wedding_id", wid)
        .order("id")
        .range(f, t),
    ),
    fetchAll((f, t) =>
      sb
        .from("events")
        .select("id, name, meal_choice")
        .eq("wedding_id", wid)
        .order("sort_order")
        .range(f, t),
    ),
    fetchAll((f, t) =>
      sb
        .from("meal_options")
        .select("id, name, description, translations")
        .eq("wedding_id", wid)
        .order("sort_order")
        .order("created_at")
        .range(f, t),
    ),
    fetchAll((f, t) =>
      sb
        .from("email_sends")
        .select("household_id, kind, status, created_at, opened_at")
        .eq("wedding_id", wid)
        .order("created_at", { ascending: false })
        .range(f, t),
    ),
  ]);

  const firstNames = new Map(guests.map((g) => [g.id, g.first_name]));
  const guestsByHousehold = new Map<string, typeof guests>();
  for (const g of guests) {
    const list = guestsByHousehold.get(g.household_id) ?? [];
    list.push(g);
    guestsByHousehold.set(g.household_id, list);
  }
  // emails are sorted newest first, so the first one per household is the latest
  const lastEmail = new Map<string, (typeof emails)[number]>();
  for (const e of emails) if (!lastEmail.has(e.household_id)) lastEmail.set(e.household_id, e);

  return {
    households: households.map((h) => {
      const members = guestsByHousehold.get(h.id) ?? [];
      const email = lastEmail.get(h.id);
      return {
        id: h.id,
        name: h.name,
        code: h.rsvp_code,
        respondedAt: h.rsvp_responded_at,
        songRequest: h.rsvp_song_request,
        message: h.rsvp_message,
        guests: members.map((g) => ({
          id: g.id,
          name: guestDisplayName(g, g.plus_one_of ? firstNames.get(g.plus_one_of) : null),
          email: g.email,
          isPlusOne: !!g.plus_one_of,
        })),
        lastEmail: email
          ? {
              kind: email.kind,
              status: email.status,
              sentAt: email.created_at,
              openedAt: email.opened_at,
            }
          : null,
        reply: householdReply(
          members.map((g) => g.id),
          invites,
          responses,
        ),
      };
    }),
    events: events.map((e) => ({ id: e.id, name: e.name, mealChoice: e.meal_choice })),
    mealOptions,
    totals: eventTotals(
      events.map((e) => e.id),
      invites,
      responses,
    ),
    meals: mealCounts(
      events.filter((e) => e.meal_choice).map((e) => e.id),
      responses,
    ),
  };
}
