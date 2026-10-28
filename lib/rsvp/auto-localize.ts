import "server-only";
import { autoTranslate } from "@/lib/i18n/auto-translate";
import type { RsvpData, RsvpExtras } from "./types";

/** The couple's RSVP page texts that guests get machine-translated. */
export const AUTO_RSVP_FIELDS = [
  "rsvp_welcome",
  "rsvp_thanks",
  "rsvp_sorry",
  "rsvp_contact",
] as const;
export type AutoRsvpField = (typeof AUTO_RSVP_FIELDS)[number];
/** field → the couple's original text, for each text that was machine-translated */
export type RsvpOriginals = Partial<Record<AutoRsvpField, string>>;

/**
 * Fills in machine translations of the couple's RSVP texts in `locale` where
 * the couple hasn't saved their own translation. A saved translation always wins.
 */
export async function autoTranslateRsvp(
  data: RsvpData,
  extras: RsvpExtras | null,
  locale: string,
): Promise<{ data: RsvpData; originals: RsvpOriginals }> {
  const saved = extras?.translations?.[locale] as Record<string, unknown> | undefined;
  const originals: RsvpOriginals = {};
  const wedding = { ...data.wedding };
  await Promise.all(
    AUTO_RSVP_FIELDS.map(async (field) => {
      const original = data.wedding[field]?.trim();
      const own = saved?.[field];
      if (!original || (typeof own === "string" && own.trim())) return;
      const translated = (
        await autoTranslate(original, extras?.languages?.[0] ?? "en", locale, { byCouple: true })
      )?.trim();
      if (!translated || translated === original) return;
      wedding[field] = translated;
      originals[field] = original;
    }),
  );
  return { data: { ...data, wedding }, originals };
}
