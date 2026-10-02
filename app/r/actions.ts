"use server";

import { getTranslations } from "next-intl/server";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { emailFrom, getResend } from "@/lib/email/resend";
import { isLocale, type Locale } from "@/i18n/locales";
import { rsvpErrorKey, type RsvpResult } from "@/lib/rsvp/types";
import { getSiteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { guestTravelSchema, rsvpPayloadSchema } from "@/lib/validation/rsvp";

// These actions are used by guests WITHOUT an account. They only call the
// get_rsvp / submit_rsvp / find_rsvp_code database functions, which check the
// household code and never expose other households.

const codeSchema = z.string().trim().min(6).max(10);

export async function submitRsvp(
  code: string,
  payload: unknown,
): Promise<ActionResult<RsvpResult>> {
  // messages in the guest's language (the request comes from /r/<code>)
  const t = await getTranslations("rsvp.errors");
  const parsedCode = codeSchema.safeParse(code);
  const parsed = rsvpPayloadSchema.safeParse(payload);
  if (!parsedCode.success) return { ok: false, error: t("rsvp_not_found") };
  if (!parsed.success) return { ok: false, error: t("generic") };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_rsvp", {
    p_code: parsedCode.data,
    p_payload: parsed.data,
  });
  if (error || !data) {
    console.error("[submitRsvp]", error);
    return { ok: false, error: t(rsvpErrorKey(error?.message)) };
  }

  const result = data as RsvpResult;
  // Optional email to the couple. Never let a mail problem fail the RSVP.
  await notifyCoupleByEmail(result).catch((e) => console.error("[notifyCoupleByEmail]", e));
  return { ok: true, data: result };
}

/** Emails owners/editors about a reply, if the couple switched it on (needs the secret key + Resend). */
async function notifyCoupleByEmail(result: RsvpResult) {
  const admin = createAdminClient();
  const resend = getResend();
  if (!admin || !resend) return;

  const { data: wedding } = await admin
    .from("weddings")
    .select("partner_a_name, partner_b_name, rsvp_notify_email, languages")
    .eq("id", result.wedding_id)
    .single();
  if (!wedding?.rsvp_notify_email) return;

  const { data: members } = await admin
    .from("wedding_members")
    .select("role, profile:profiles(email, locale)")
    .eq("wedding_id", result.wedding_id)
    .in("role", ["owner", "editor"]);
  // one email per language, so everyone reads it in the app language they chose
  const fallback: Locale = isLocale(wedding.languages?.[0]) ? wedding.languages[0] : "en";
  const byLocale = new Map<Locale, string[]>();
  for (const m of members ?? []) {
    if (!m.profile?.email) continue;
    const locale = isLocale(m.profile.locale) ? m.profile.locale : fallback;
    byLocale.set(locale, [...(byLocale.get(locale) ?? []), m.profile.email]);
  }
  if (byLocale.size === 0) return;

  const link = `${await getSiteUrl()}/app/rsvp?household=${result.household_id}`;
  for (const [locale, to] of byLocale) {
    const t = await getTranslations({ locale, namespace: "notices.coupleEmail" });
    const subject = t(result.updated ? "updated" : "replied", { name: result.household_name });
    const summary = t("summary", { attending: result.attending, declined: result.declined });
    await resend.emails.send({
      from: emailFrom("Vow"),
      to,
      subject,
      text: `${subject}: ${summary}.\n\n${t("seeAll")}: ${link}`,
      html: `<p><strong>${escapeHtml(subject)}</strong>: ${escapeHtml(summary)}.</p><p><a href="${link}">${escapeHtml(t("seeAll"))}</a></p>`,
    });
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** "Find your invitation": full name → RSVP code (or a friendly error). */
export async function findInvitation(
  slug: string,
  name: string,
): Promise<ActionResult<{ code: string }>> {
  const t = await getTranslations("rsvp.find");
  const cleanName = name.trim().replace(/\s+/g, " ");
  if (cleanName.split(" ").length < 2) return { ok: false, error: t("fullName") };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("find_rsvp_code", {
    p_slug: slug.slice(0, 60),
    p_name: cleanName.slice(0, 160),
  });
  if (error) {
    console.error("[findInvitation]", error);
    return { ok: false, error: t("failed") };
  }
  if (!data) {
    return { ok: false, error: t("noMatch") };
  }
  return { ok: true, data: { code: data } };
}

/** A guest picked a language on their RSVP page: remember it for emails and links. */
export async function setRsvpLanguage(code: string, language: string): Promise<ActionResult> {
  if (!codeSchema.safeParse(code).success || !isLocale(language))
    return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_rsvp_language", { p_code: code, p_language: language });
  if (error) console.error("[setRsvpLanguage]", error);
  return { ok: true };
}

/** Guest submits their travel details after RSVPing "yes". */
export async function submitGuestTravel(
  code: string,
  payload: unknown,
): Promise<ActionResult> {
  const t = await getTranslations("rsvp.errors");
  const parsedCode = codeSchema.safeParse(code);
  const parsed = guestTravelSchema.safeParse(payload);
  if (!parsedCode.success) return { ok: false, error: t("rsvp_not_found") };
  if (!parsed.success) return { ok: false, error: t("generic") };

  const data = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_guest_travel", {
    p_code: parsedCode.data,
    p_payload: {
      arrival_date: data.arrival_date || null,
      arrival_time: data.arrival_time || null,
      arrival_airport: data.arrival_airport || null,
      arrival_flight: data.arrival_flight || null,
      departure_date: data.departure_date || null,
      departure_time: data.departure_time || null,
      departure_airport: data.departure_airport || null,
      departure_flight: data.departure_flight || null,
      staying_at: data.staying_at || null,
      hotel_id: data.hotel_id || null,
      needs_transfer: data.needs_transfer ?? false,
      transport_notes: data.transport_notes || null,
    },
  });
  if (error) {
    console.error("[submitGuestTravel]", error);
    return { ok: false, error: t("generic") };
  }
  return { ok: true };
}
