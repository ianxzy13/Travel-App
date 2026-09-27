"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { APP_LOCALE_COOKIE } from "@/i18n/locales";
import type { ActionResult } from "@/lib/action-result";
import {
  EVENT_TEXT_FIELDS,
  MEAL_TEXT_FIELDS,
  WEDDING_TEXT_FIELDS,
  pruneTranslation,
} from "@/lib/i18n/content";
import { createClient } from "@/lib/supabase/server";
import {
  localeSchema,
  translationsSchema,
  weddingLanguagesSchema,
} from "@/lib/validation/languages";
import { canEdit, getUser, requireWedding } from "@/lib/wedding";
import { err, fail, invalid, noPermission } from "@/lib/errors";

/**
 * The couple's own language (what they write their texts in) and the venue's
 * time zone. The database adds every household's language after it.
 */
export async function updateLanguages(input: unknown): Promise<ActionResult> {
  const { wedding, role } = await requireWedding();
  if (!canEdit(role)) return noPermission();
  const parsed = weddingLanguagesSchema.safeParse(input);
  if (!parsed.success) return await invalid(parsed.error);
  const sb = await createClient();
  const { error } = await sb
    .from("weddings")
    .update({ languages: [parsed.data.language], time_zone: parsed.data.timeZone || null })
    .eq("id", wedding.id);
  if (error) return fail("updateLanguages", error);
  revalidatePath("/app", "layout");
  return { ok: true };
}

/**
 * The app language (remembered in a cookie, and in the profile when signed in,
 * so it follows the person to other devices). Works before signing in too.
 */
export async function setAppLanguage(locale: string): Promise<ActionResult> {
  const parsed = localeSchema.safeParse(locale);
  if (!parsed.success) return await err("generic");
  (await cookies()).set(APP_LOCALE_COOKIE, parsed.data, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  const user = await getUser();
  if (user) {
    const sb = await createClient();
    const { error } = await sb.from("profiles").update({ locale: parsed.data }).eq("id", user.id);
    if (error) console.error("[setAppLanguage]", error);
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

const id = z.uuid();
const clean = (t: Record<string, Record<string, string | undefined>>) =>
  Object.fromEntries(
    Object.entries(t)
      .map(([l, v]) => [l, pruneTranslation(v)])
      .filter(([, v]) => Object.keys(v).length),
  );

/** Per-language texts of one event (name, venue name, dress code, description). */
export async function saveEventTranslations(
  eventId: string,
  input: unknown,
): Promise<ActionResult> {
  const { wedding, role } = await requireWedding();
  if (!canEdit(role) || !id.safeParse(eventId).success) return noPermission();
  const parsed = translationsSchema(EVENT_TEXT_FIELDS).safeParse(input);
  if (!parsed.success) return await invalid(parsed.error);
  const sb = await createClient();
  const { error } = await sb
    .from("events")
    .update({ translations: clean(parsed.data) })
    .eq("id", eventId)
    .eq("wedding_id", wedding.id);
  if (error) return fail("saveEventTranslations", error);
  revalidatePath("/app/settings");
  return { ok: true };
}

/** Per-language names of one meal option. */
export async function saveMealTranslations(mealId: string, input: unknown): Promise<ActionResult> {
  const { wedding, role } = await requireWedding();
  if (!canEdit(role) || !id.safeParse(mealId).success) return noPermission();
  const parsed = translationsSchema(MEAL_TEXT_FIELDS, 300).safeParse(input);
  if (!parsed.success) return await invalid(parsed.error);
  const sb = await createClient();
  const { error } = await sb
    .from("meal_options")
    .update({ translations: clean(parsed.data) })
    .eq("id", mealId)
    .eq("wedding_id", wedding.id);
  if (error) return fail("saveMealTranslations", error);
  revalidatePath("/app/rsvp");
  return { ok: true };
}

/** Per-language location and RSVP contact line. */
export async function saveWeddingTranslations(input: unknown): Promise<ActionResult> {
  const { wedding, role } = await requireWedding();
  if (!canEdit(role)) return noPermission();
  const parsed = translationsSchema(WEDDING_TEXT_FIELDS, 300).safeParse(input);
  if (!parsed.success) return await invalid(parsed.error);
  const sb = await createClient();
  const { error } = await sb
    .from("weddings")
    .update({ translations: clean(parsed.data) })
    .eq("id", wedding.id);
  if (error) return fail("saveWeddingTranslations", error);
  revalidatePath("/app", "layout");
  return { ok: true };
}
