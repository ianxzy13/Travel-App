"use server";

import { render } from "@react-email/components";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { TravelReminderEmail } from "@/emails/travel-reminder-email";
import type { ActionResult } from "@/lib/action-result";
import { emailFrom, getResend } from "@/lib/email/resend";
import { isLocale, isRtl, type Locale } from "@/i18n/locales";
import { localized } from "@/lib/i18n/content";
import { fmtDate } from "@/lib/i18n/format";
import { getSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import { flightSchema } from "@/lib/validation/places";
import { canEdit, coupleName, requireUser, requireWedding } from "@/lib/wedding";
import { fail, invalid, noPermission } from "@/lib/errors";

async function editor() {
  const { wedding, role } = await requireWedding();
  if (!canEdit(role)) return null;
  return { wedding, sb: await createClient() };
}

function done(): ActionResult {
  revalidatePath("/app/travel");
  return { ok: true };
}

export async function saveFlight(input: unknown, id?: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return noPermission();
  const parsed = flightSchema.safeParse(input);
  if (!parsed.success) return await invalid(parsed.error);
  const v = parsed.data;
  const wid = ctx.wedding.id;
  const row = {
    category: v.category,
    direction: v.direction,
    status: v.status,
    airline: v.airline || null,
    flight_number: v.flightNumber.toUpperCase().replace(/\s+/g, "") || null,
    from_airport: v.fromAirport.toUpperCase() || null,
    to_airport: v.toAirport.toUpperCase() || null,
    depart_at: v.departAt || null,
    arrive_at: v.arriveAt || null,
    booking_ref: v.bookingRef.toUpperCase() || null,
    price: v.price,
    baggage: v.baggage || null,
    other_travellers: v.otherTravellers || null,
    needs_pickup: v.needsPickup,
    notes: v.notes || null,
  };

  let flightId = id;
  if (flightId) {
    const { error } = await ctx.sb
      .from("flights")
      .update(row)
      .eq("id", flightId)
      .eq("wedding_id", wid);
    if (error) return fail("saveFlight", error);
  } else {
    const { data, error } = await ctx.sb
      .from("flights")
      .insert({ ...row, wedding_id: wid })
      .select("id")
      .single();
    if (error) return fail("saveFlight", error);
    flightId = data.id;
  }

  // travellers: replace the set
  const { error: delError } = await ctx.sb
    .from("flight_travellers")
    .delete()
    .eq("flight_id", flightId);
  if (delError) return fail("saveFlight travellers", delError);
  if (v.travellerIds.length) {
    const { error } = await ctx.sb
      .from("flight_travellers")
      .insert(
        v.travellerIds.map((guest_id) => ({ flight_id: flightId!, guest_id, wedding_id: wid })),
      );
    if (error) return fail("saveFlight travellers", error);
  }
  return done();
}

export async function deleteFlight(id: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !z.uuid().safeParse(id).success) return noPermission();
  const { error } = await ctx.sb
    .from("flights")
    .delete()
    .eq("id", id)
    .eq("wedding_id", ctx.wedding.id);
  if (error) return fail("deleteFlight", error);
  return done();
}

export async function setDestinationAirport(code: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return noPermission();
  const c = code.trim().toUpperCase();
  if (c && !/^[A-Z]{3}$/.test(c)) return await invalid({ issues: [{ message: "v.airport" }] });
  const { error } = await ctx.sb
    .from("weddings")
    .update({ destination_airport: c || null })
    .eq("id", ctx.wedding.id);
  if (error) return fail("setDestinationAirport", error);
  return done();
}

// ---------- travel reminder emails ----------

export type TravelReminderSummary = { sent: number; failed: number; noEmail: string[] };

function emailLocale(
  wedding: { languages: string[] | null },
  preferred: string | null | undefined,
): Locale {
  if (isLocale(preferred)) return preferred;
  const main = wedding.languages?.[0];
  return isLocale(main) ? main : "en";
}

export async function sendTravelReminder(
  householdIds: string[],
): Promise<ActionResult<TravelReminderSummary>> {
  const user = await requireUser();
  const ctx = await editor();
  if (!ctx) return noPermission();
  const resend = getResend();
  if (!resend) {
    return { ok: false, error: "Email is not set up (RESEND_API_KEY)." };
  }

  const { wedding, sb } = ctx;

  const households: {
    id: string;
    name: string;
    rsvp_code: string;
    preferred_language: string | null;
  }[] = [];
  const guests: { id: string; household_id: string; email: string | null }[] = [];
  for (let i = 0; i < householdIds.length; i += 100) {
    const batch = householdIds.slice(i, i + 100);
    const [h, g] = await Promise.all([
      sb
        .from("households")
        .select("id, name, rsvp_code, preferred_language")
        .eq("wedding_id", wedding.id)
        .in("id", batch),
      sb
        .from("guests")
        .select("id, household_id, email")
        .eq("wedding_id", wedding.id)
        .in("household_id", batch)
        .is("plus_one_of", null)
        .not("email", "is", null)
        .eq("email_unsubscribed", false),
    ]);
    if (h.error || g.error) return fail("sendTravelReminder", h.error ?? g.error);
    households.push(...h.data);
    guests.push(...g.data);
  }

  const emailsByHousehold = new Map<string, string[]>();
  const firstGuestByHousehold = new Map<string, string>();
  for (const g of guests) {
    const email = g.email?.trim().toLowerCase();
    if (!email) continue;
    const list = emailsByHousehold.get(g.household_id) ?? [];
    if (!list.includes(email)) list.push(email);
    emailsByHousehold.set(g.household_id, list);
    if (!firstGuestByHousehold.has(g.household_id)) {
      firstGuestByHousehold.set(g.household_id, g.id);
    }
  }

  const noEmail = households.filter((h) => !emailsByHousehold.has(h.id)).map((h) => h.name);
  const sendable = households.filter((h) => emailsByHousehold.has(h.id));
  const siteUrl = await getSiteUrl();
  const couple = coupleName(wedding);
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < sendable.length; i += 100) {
    const chunk = sendable.slice(i, i + 100);
    const messages = await Promise.all(
      chunk.map(async (h) => {
        const locale = emailLocale(wedding, h.preferred_language);
        const t = await getTranslations({ locale, namespace: "travelEmail" });
        const link = `${siteUrl}/r/${h.rsvp_code}?lang=${locale}&travel=1`;
        const place = localized(wedding, locale, ["location"]).location;
        const guestId = firstGuestByHousehold.get(h.id);
        const element = TravelReminderEmail({
          lang: locale,
          rtl: isRtl(locale),
          text: {
            preview: t("preview", { couple }),
            eyebrow: t("eyebrow"),
            dear: t("dear", { name: h.name }),
            body: t("body"),
            button: t("button"),
            fallback: t("fallback", { link }),
            love: t("love"),
          },
          couple,
          householdName: h.name,
          dateText: wedding.wedding_date ? fmtDate(wedding.wedding_date, locale, "full") : null,
          location: place,
          link,
          accent: wedding.accent,
          unsubscribeUrl: guestId
            ? `${siteUrl}/r/unsubscribe?code=${h.rsvp_code}&guest=${guestId}`
            : undefined,
        });
        return {
          from: emailFrom(couple),
          to: emailsByHousehold.get(h.id)!,
          replyTo: user.email,
          subject: t("subject", { couple }),
          html: await render(element),
          text: await render(element, { plainText: true }),
        };
      }),
    );

    const { data, error } = await resend.batch.send(messages);
    if (error) {
      console.error("[sendTravelReminder] Resend error", error);
      failed += chunk.length;
    } else {
      sent += chunk.length;
    }
  }

  revalidatePath("/app/travel");
  if (sent === 0 && failed > 0) {
    return { ok: false, error: "Resend refused the emails." };
  }
  return { ok: true, data: { sent, failed, noEmail } };
}
