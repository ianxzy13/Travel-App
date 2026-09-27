import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { APP_LOCALE_COOKIE, isLocale } from "@/i18n/locales";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/wedding";

/** The language this person picked (saved in their profile), or null if they haven't yet. */
export const chosenLocale = cache(async () => {
  const user = await getUser();
  if (!user) return null;
  const sb = await createClient();
  const { data } = await sb.from("profiles").select("locale").eq("id", user.id).maybeSingle();
  return isLocale(data?.locale) ? data.locale : null;
});

/**
 * Before someone starts using the app, ask which language they prefer.
 * (A choice made on the sign-in page counts: it is saved when they sign in.)
 */
export async function requireLanguageChoice(next: string) {
  if (!(await getUser()) || (await chosenLocale())) return;
  redirect(`/welcome?next=${encodeURIComponent(next)}`);
}

/** The app-language cookie, if the person picked one on this device. */
export async function cookieLocale() {
  const v = (await cookies()).get(APP_LOCALE_COOKIE)?.value;
  return isLocale(v) ? v : null;
}
