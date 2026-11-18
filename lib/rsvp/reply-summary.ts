import type { RsvpReplyGuest } from "@/emails/rsvp-reply-email";
import { localized } from "@/lib/i18n/content";
import type { RsvpStatus, Translations } from "@/lib/database.types";

type Guest = { id: string; first_name: string; last_name: string; dietary: string | null };
type Event = { id: string; name: string; sort_order: number; translations: Translations | null };
type Meal = { id: string; name: string; translations: Translations | null };
type Invite = { guest_id: string; event_id: string };
type Response = {
  guest_id: string;
  event_id: string;
  status: RsvpStatus;
  meal_option_id: string | null;
};

/**
 * One household's answers, guest by guest and event by event, with event and
 * meal names in `locale` (`shown` turns untouched starter texts like
 * "Ceremony" into that language). Only events a guest is invited to are listed.
 */
export function replyGuests(
  input: {
    guests: Guest[];
    events: Event[];
    meals: Meal[];
    invites: Invite[];
    responses: Response[];
  },
  locale: string,
  shown: (text: string) => string = (text) => text,
): { guests: RsvpReplyGuest[]; eventCount: number } {
  const events = [...input.events]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((e) => ({ id: e.id, name: shown(localized(e, locale, ["name"]).name) }));
  const meals = new Map(input.meals.map((m) => [m.id, localized(m, locale, ["name"]).name]));
  const invited = new Set(input.invites.map((i) => `${i.guest_id}:${i.event_id}`));
  const answer = new Map(input.responses.map((r) => [`${r.guest_id}:${r.event_id}`, r]));
  const usedEvents = new Set<string>();

  const guests = input.guests.map((g) => {
    const rows = events
      .filter((e) => invited.has(`${g.id}:${e.id}`) || answer.has(`${g.id}:${e.id}`))
      .map((e) => {
        usedEvents.add(e.id);
        const r = answer.get(`${g.id}:${e.id}`);
        return {
          name: e.name,
          status: r?.status ?? null,
          meal: r?.meal_option_id ? (meals.get(r.meal_option_id) ?? null) : null,
        };
      });
    return {
      name: `${g.first_name} ${g.last_name}`.trim(),
      dietary: g.dietary?.trim() || null,
      events: rows,
    };
  });
  return { guests, eventCount: usedEvents.size };
}
