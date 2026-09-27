import type { RsvpStatus } from "@/lib/database.types";
import type { RsvpData } from "./types";

/** One person's answer for one event. */
export type Answer = { status: RsvpStatus | null; mealOptionId: string | null };

export type RsvpFormState = {
  /** key: `${guestId}:${eventId}` */
  answers: Record<string, Answer>;
  /** per person: plus-one names and dietary notes */
  people: Record<string, { firstName: string; lastName: string; dietary: string }>;
  songRequest: string;
  message: string;
};

export const answerKey = (guestId: string, eventId: string) => `${guestId}:${eventId}`;

export function needsMeal(data: RsvpData, eventId: string) {
  return data.meal_options.length > 0 && !!data.events.find((e) => e.id === eventId)?.meal_choice;
}

/** Starts the form from the household's previous answers (if any). */
export function initialFormState(data: RsvpData): RsvpFormState {
  const previous = new Map(data.responses.map((r) => [answerKey(r.guest_id, r.event_id), r]));
  const answers: RsvpFormState["answers"] = {};
  for (const i of data.invites) {
    const key = answerKey(i.guest_id, i.event_id);
    const r = previous.get(key);
    answers[key] = { status: r?.status ?? null, mealOptionId: r?.meal_option_id ?? null };
  }
  const people: RsvpFormState["people"] = {};
  for (const g of data.guests) {
    people[g.id] = { firstName: g.first_name, lastName: g.last_name, dietary: g.dietary ?? "" };
  }
  return {
    answers,
    people,
    songRequest: data.household.song_request ?? "",
    message: data.household.message ?? "",
  };
}

export type MissingAnswer = { guestId: string; eventId: string; kind: "status" | "meal" };

/** Lists every question still unanswered: attending/not, and meal when coming. */
export function findMissing(data: RsvpData, state: RsvpFormState): MissingAnswer[] {
  const missing: MissingAnswer[] = [];
  for (const i of data.invites) {
    const a = state.answers[answerKey(i.guest_id, i.event_id)];
    if (!a?.status) missing.push({ guestId: i.guest_id, eventId: i.event_id, kind: "status" });
    else if (a.status === "attending" && needsMeal(data, i.event_id) && !a.mealOptionId) {
      missing.push({ guestId: i.guest_id, eventId: i.event_id, kind: "meal" });
    }
  }
  return missing;
}

/** The JSON sent to submit_rsvp(). */
export function toPayload(data: RsvpData, state: RsvpFormState) {
  const plusOnes = new Set(data.guests.filter((g) => g.plus_one_of).map((g) => g.id));
  return {
    responses: data.invites.flatMap((i) => {
      const a = state.answers[answerKey(i.guest_id, i.event_id)];
      if (!a?.status) return [];
      return [
        {
          guest_id: i.guest_id,
          event_id: i.event_id,
          status: a.status,
          meal_option_id:
            a.status === "attending" && needsMeal(data, i.event_id) ? a.mealOptionId : null,
        },
      ];
    }),
    guests: data.guests.map((g) => {
      const p = state.people[g.id];
      return plusOnes.has(g.id)
        ? { id: g.id, dietary: p.dietary, first_name: p.firstName, last_name: p.lastName }
        : { id: g.id, dietary: p.dietary };
    }),
    song_request: state.songRequest,
    message: state.message,
  };
}

export type GuestNameLabels = { guestOf: (name: string) => string; guest: string };
const ENGLISH_LABELS: GuestNameLabels = { guestOf: (name) => `${name}'s guest`, guest: "Guest" };

/** Display name on the RSVP page ("Ann's guest" for an unnamed plus-one). */
export function rsvpGuestName(
  data: RsvpData,
  guestId: string,
  state?: RsvpFormState,
  labels: GuestNameLabels = ENGLISH_LABELS,
) {
  const g = data.guests.find((x) => x.id === guestId);
  if (!g) return "";
  const p = state?.people[guestId];
  const name = `${p?.firstName ?? g.first_name} ${p?.lastName ?? g.last_name}`.trim();
  if (name) return name;
  const host = data.guests.find((x) => x.id === g.plus_one_of);
  return host ? labels.guestOf(host.first_name) : labels.guest;
}
