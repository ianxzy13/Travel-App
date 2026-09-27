import "server-only";
import { cookies } from "next/headers";
import { APP_LOCALE_COOKIE, isLocale } from "@/i18n/locales";
import type { createClient } from "@/lib/supabase/server";

/** After signing in: bring back the app language this person chose before (on any device). */
export async function rememberAppLocale(sb: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return;
  const { data } = await sb.from("profiles").select("locale").eq("id", user.id).maybeSingle();
  if (isLocale(data?.locale)) {
    (await cookies()).set(APP_LOCALE_COOKIE, data.locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }
}
