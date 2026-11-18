import "server-only";
import { render } from "@react-email/components";
import { getTranslations } from "next-intl/server";
import { RsvpReplyEmail } from "@/emails/rsvp-reply-email";
import { emailFrom, getResend } from "@/lib/email/resend";
import { starterTexts } from "@/lib/i18n/defaults";
import { isLocale, isRtl, type Locale } from "@/i18n/locales";
import { getSiteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { replyGuests } from "./reply-summary";
import type { RsvpResult } from "./types";

/**
 * Emails the couple (owners and editors) about a guest's RSVP, if "Email me
 * when someone replies" is on. Each person gets it in the app language they
 * chose. Needs SUPABASE_SECRET_KEY and RESEND_API_KEY; without them it does
 * nothing (the bell in the app still shows the reply).
 */
export async function notifyCoupleByEmail(result: RsvpResult) {
  const admin = createAdminClient();
  const resend = getResend();
  if (!admin || !resend) return;

  const { data: wedding } = await admin
    .from("weddings")
    .select("partner_a_name, partner_b_name, rsvp_notify_email, languages, accent")
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
    const email = m.profile?.email;
    if (!email) continue;
    const locale = isLocale(m.profile?.locale) ? m.profile.locale : fallback;
    const list = byLocale.get(locale) ?? [];
    if (!list.includes(email)) byLocale.set(locale, [...list, email]);
  }
  if (byLocale.size === 0) return;

  const [household, guests, events, meals] = await Promise.all([
    admin
      .from("households")
      .select("rsvp_message, rsvp_song_request")
      .eq("id", result.household_id)
      .single(),
    admin
      .from("guests")
      .select("id, first_name, last_name, dietary")
      .eq("household_id", result.household_id)
      .order("created_at"),
    admin
      .from("events")
      .select("id, name, sort_order, translations")
      .eq("wedding_id", result.wedding_id),
    admin.from("meal_options").select("id, name, translations").eq("wedding_id", result.wedding_id),
  ]);
  const guestIds = (guests.data ?? []).map((g) => g.id);
  const [invites, responses] = guestIds.length
    ? await Promise.all([
        admin.from("guest_event_invites").select("guest_id, event_id").in("guest_id", guestIds),
        admin
          .from("rsvp_responses")
          .select("guest_id, event_id, status, meal_option_id")
          .in("guest_id", guestIds),
      ])
    : [{ data: [] }, { data: [] }];

  const link = `${await getSiteUrl()}/app/rsvp?household=${result.household_id}`;
  const accent = wedding.accent === "sage" ? "sage" : "rose";

  for (const [locale, to] of byLocale) {
    try {
      const t = await getTranslations({ locale, namespace: "notices.coupleEmail" });
      const shown = await starterTexts(locale);
      const { guests: rows, eventCount } = replyGuests(
        {
          guests: guests.data ?? [],
          events: events.data ?? [],
          meals: meals.data ?? [],
          invites: invites.data ?? [],
          responses: responses.data ?? [],
        },
        locale,
        (text) => shown(text),
      );
      const subject = t(result.updated ? "updated" : "replied", { name: result.household_name });
      const summary = t("summary", { attending: result.attending, declined: result.declined });
      const element = RsvpReplyEmail({
        lang: locale,
        rtl: isRtl(locale),
        text: {
          preview: `${subject}: ${summary}`,
          eyebrow: t(result.updated ? "eyebrowUpdated" : "eyebrowNew"),
          summary,
          attending: t("attending"),
          declined: t("declined"),
          noAnswer: t("noAnswer"),
          dietary: t("dietary"),
          song: t("song"),
          message: t("message"),
          button: t("seeAll"),
          why: t("why"),
        },
        householdName: result.household_name,
        guests: rows,
        showEventNames: eventCount > 1,
        songRequest: household.data?.rsvp_song_request?.trim() || null,
        message: household.data?.rsvp_message?.trim() || null,
        link,
        accent,
      });
      const { error } = await resend.emails.send({
        from: emailFrom("Vow"),
        to,
        subject,
        html: await render(element),
        text: await render(element, { plainText: true }),
      });
      if (error) console.error("[notifyCoupleByEmail]", locale, error);
    } catch (e) {
      console.error("[notifyCoupleByEmail]", locale, e);
    }
  }
}
