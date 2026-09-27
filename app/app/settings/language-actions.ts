"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { APP_LOCALE_COOKIE } from "@/i18n/locales";
import { fail, type ActionResult } from "@/lib/action-result";
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
import { canEdit, requireUser, requireWedding } from "@/lib/wedding";

const NO_PERMISSION = { ok: false as const, error: "You don't have permission to do that." };

/** The wedding's languages (main one first) and the venue's time zone. */
export async function updateLanguages(input: unknown): Promise<ActionResult> {
  const { wedding, role } = await requireWedding();
  if (!canEdit(role)) return NO_PERMISSION;
  const parsed = weddingLanguagesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const sb = await createClient();
  const { error } = await sb
    .from("weddings")
    .update({ languages: parsed.data.languages, time_zone: parsed.data.timeZone || null })
    .eq("id", wedding.id);
  if (error) return fail("updateLanguages", error);
  revalidatePath("/app", "layout");
  return { ok: true };
}

/** The app language for the signed-in person (remembered in a cookie and their profile). */
export async function setAppLanguage(locale: string): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = localeSchema.safeParse(locale);
  if (!parsed.success) return { ok: false, error: "Unknown language" };
  (await cookies()).set(APP_LOCALE_COOKIE, parsed.data, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  const sb = await createClient();
  const { error } = await sb.from("profiles").update({ locale: parsed.data }).eq("id", user.id);
  if (error) console.error("[setAppLanguage]", error);
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
  if (!canEdit(role) || !id.safeParse(eventId).success) return NO_PERMISSION;
  const parsed = translationsSchema(EVENT_TEXT_FIELDS).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
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
  if (!canEdit(role) || !id.safeParse(mealId).success) return NO_PERMISSION;
  const parsed = translationsSchema(MEAL_TEXT_FIELDS, 300).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
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
  if (!canEdit(role)) return NO_PERMISSION;
  const parsed = translationsSchema(WEDDING_TEXT_FIELDS, 300).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const sb = await createClient();
  const { error } = await sb
    .from("weddings")
    .update({ translations: clean(parsed.data) })
    .eq("id", wedding.id);
  if (error) return fail("saveWeddingTranslations", error);
  revalidatePath("/app", "layout");
  return { ok: true };
}
