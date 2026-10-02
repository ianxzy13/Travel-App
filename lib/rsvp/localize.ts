import {
  EVENT_TEXT_FIELDS,
  MEAL_TEXT_FIELDS,
  WEDDING_TEXT_FIELDS,
  localized,
} from "@/lib/i18n/content";
import type { RsvpData, RsvpExtras } from "./types";

/**
 * One household's RSVP data with the couple's texts in `locale` (main language
 * where not translated). `shown` puts untouched starter texts (e.g. the default
 * "Ceremony") in that language too.
 */
export function localizeRsvp(
  data: RsvpData,
  extras: RsvpExtras | null,
  locale: string,
  shown: (text: string) => string = (text) => text,
): RsvpData {
  const named = { ...data, events: data.events.map((e) => ({ ...e, name: shown(e.name) })) };
  if (!extras) return named;
  return {
    ...data,
    wedding: localized({ ...data.wedding, translations: extras.translations }, locale, [
      ...WEDDING_TEXT_FIELDS,
    ]),
    events: data.events.map((e) => {
      const ev = localized({ ...e, translations: extras.events[e.id] }, locale, [
        ...EVENT_TEXT_FIELDS,
      ]);
      return { ...ev, name: shown(ev.name) };
    }),
    meal_options: data.meal_options.map((m) =>
      localized({ ...m, translations: extras.meals[m.id] }, locale, [...MEAL_TEXT_FIELDS]),
    ),
  };
}
