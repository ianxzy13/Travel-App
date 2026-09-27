import { cache } from "react";
import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { APP_LOCALE_COOKIE, GUEST_LOCALE_COOKIE, type Locale } from "./locales";
import { loadMessages } from "./messages";
import { resolveAppLocale, resolveGuestLocale } from "./resolve";

/** Guests' pages (website, RSVP, shared boards). */
export const isGuestPath = (path: string) => /^\/(w|rsvp|r|b)(\/|$)/.test(path);

/** Public pages guests open; their language depends on the wedding. */
function publicPage(path: string): { kind: "site" | "rsvp" | "board"; key: string | null } | null {
  // the bare code page (/r) belongs to no wedding yet, so any language is fine
  if (path === "/r" || path === "/r/") return { kind: "rsvp", key: null };
  const m = path.match(/^\/(w|rsvp|r|b)\/([^/]+)/);
  if (!m) return null;
  const key = decodeURIComponent(m[2]);
  return { kind: m[1] === "r" ? "rsvp" : m[1] === "b" ? "board" : "site", key };
}

/** The language for this request (cached, so the page and metadata agree). */
export const requestLocale = cache(async (): Promise<Locale> => {
  const h = await headers();
  const jar = await cookies();
  const path = h.get("x-vow-path") ?? "";
  const accept = h.get("accept-language");
  const page = publicPage(path);
  if (!page)
    return resolveAppLocale({ cookie: jar.get(APP_LOCALE_COOKIE)?.value, acceptLanguage: accept });

  let info: { languages: string[]; preferred: string | null } | null = null;
  if (isSupabaseConfigured && page.key) {
    const { data } = await (
      await createClient()
    ).rpc("get_page_languages", { p_kind: page.kind, p_key: page.key });
    info = data as { languages: string[]; preferred: string | null } | null;
  }
  return resolveGuestLocale({
    asked: h.get("x-vow-lang"),
    cookie: jar.get(GUEST_LOCALE_COOKIE)?.value,
    preferred: info?.preferred,
    acceptLanguage: accept,
    weddingLanguages: info?.languages,
  });
});

export default getRequestConfig(async () => {
  const locale = await requestLocale();
  return {
    locale,
    messages: await loadMessages(locale),
    // dates are plain calendar dates / local times, so format them without shifting
    timeZone: "UTC",
  };
});
