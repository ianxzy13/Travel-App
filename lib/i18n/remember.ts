import "server-only";
import { cookies } from "next/headers";
import { APP_LOCALE_COOKIE, isLocale } from "@/i18n/locales";
import type { createClient } from "@/lib/supabase/server";

/**
 * After signing in: bring back the app language this person chose before (on
 * any device), or save the one they just picked on the sign-in page.
 */
export async function rememberAppLocale(sb: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return;
  const jar = await cookies();
  const { data } = await sb.from("profiles").select("locale").eq("id", user.id).maybeSingle();
  if (isLocale(data?.locale)) {
    jar.set(APP_LOCALE_COOKIE, data.locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    return;
  }
  const picked = jar.get(APP_LOCALE_COOKIE)?.value;
  if (isLocale(picked)) {
    const { error } = await sb.from("profiles").update({ locale: picked }).eq("id", user.id);
    if (error) console.error("[rememberAppLocale]", error);
  }
}
