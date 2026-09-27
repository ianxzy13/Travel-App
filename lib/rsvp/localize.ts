import {
  EVENT_TEXT_FIELDS,
  MEAL_TEXT_FIELDS,
  WEDDING_TEXT_FIELDS,
  localized,
} from "@/lib/i18n/content";
import type { RsvpData, RsvpExtras } from "./types";

/** One household's RSVP data with the couple's texts in `locale` (main language where not translated). */
export function localizeRsvp(data: RsvpData, extras: RsvpExtras | null, locale: string): RsvpData {
  if (!extras) return data;
  return {
    ...data,
    wedding: localized({ ...data.wedding, translations: extras.translations }, locale, [
      ...WEDDING_TEXT_FIELDS,
    ]),
    events: data.events.map((e) =>
      localized({ ...e, translations: extras.events[e.id] }, locale, [...EVENT_TEXT_FIELDS]),
    ),
    meal_options: data.meal_options.map((m) =>
      localized({ ...m, translations: extras.meals[m.id] }, locale, [...MEAL_TEXT_FIELDS]),
    ),
  };
}
