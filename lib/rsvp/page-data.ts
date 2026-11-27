import "server-only";
import { cache } from "react";
import { getLocale } from "next-intl/server";
import { starterTexts } from "@/lib/i18n/defaults";
import { airportByCode } from "@/lib/places/airports";
import { autoTranslateRsvp } from "@/lib/rsvp/auto-localize";
import { fetchRsvp } from "@/lib/rsvp/fetch";
import { localizeRsvp } from "@/lib/rsvp/localize";
import { CODE_PATTERN, normalizeCode, type RsvpData, type RsvpExtras } from "@/lib/rsvp/types";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { guessCountryFromLocation } from "@/lib/trip/country-info";

// Loads one household's RSVP via the secure get_rsvp() function (null if the code is wrong),
// with the couple's texts in the page's language (translated automatically where they haven't).
export const loadRsvp = cache(async (rawCode: string) => {
  const code = normalizeCode(decodeURIComponent(rawCode));
  if (!CODE_PATTERN.test(code) || !isSupabaseConfigured) return null;
  const supabase = await createClient();
  const [data, { data: extras }, locale] = await Promise.all([
    fetchRsvp(code),
    supabase.rpc("get_rsvp_extras", { p_code: code }),
    getLocale(),
  ]);
  if (!data) return null;
  const x = extras as RsvpExtras | null;
  const shown = await starterTexts(locale);
  // the couple's own texts: their saved translation, else a machine translation
  const auto = await autoTranslateRsvp(localizeRsvp(data as RsvpData, x, locale, shown), x, locale);
  return { data: auto.data, originals: auto.originals, languages: x?.languages ?? [] };
});

/** A temporary link to the couple's RSVP cover photo (guests may view only that one). */
export async function coverUrl(path: string | null | undefined) {
  if (!path) return null;
  const { data } = await (
    await createClient()
  ).storage
    .from("wedding-files")
    .createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

/** The wedding's country: from the destination airport, else from the location text. */
export async function weddingCountry(airport: string | null, location: string | null) {
  if (airport) {
    const a = await airportByCode(airport).catch(() => undefined);
    if (a?.countryCode) return a.countryCode;
  }
  return guessCountryFromLocation(location);
}
