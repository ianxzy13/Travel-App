"use server";

import { render } from "@react-email/components";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import {
  SaveTheDateEmail,
  type StdEmailProps,
} from "@/emails/save-the-date-email";
import { isLocale, isRtl, type Locale } from "@/i18n/locales";
import { fmtDate } from "@/lib/i18n/format";
import type { ActionResult } from "@/lib/action-result";
import type { StdSendMethod } from "@/lib/database.types";
import { emailFrom, getResend } from "@/lib/email/resend";
import { fail, noPermission } from "@/lib/errors";
import { getSiteUrl } from "@/lib/site-url";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { canEdit, requireUser, requireWedding } from "@/lib/wedding";

async function editor() {
  const { wedding, role } = await requireWedding();
  if (!canEdit(role)) return null;
  return { wedding, supabase: await createClient() };
}

export type RecipientRow = {
  householdId: string;
  householdName: string;
  country: string | null;
  language: string | null;
  guestNames: string[];
  emails: string[];
  phones: string[];
  side: string;
  tags: string[];
  events: string[];
  declined: boolean;
  method: StdSendMethod | null;
  methodOverride: boolean;
  status: string;
  token: string | null;
  sendId: string | null;
  toAddress: string | null;
  error: string | null;
};

export type RecipientSummary = {
  total: number;
  byEmail: number;
  bySms: number;
  noContact: number;
  alreadySent: number;
  declined: number;
};

export async function loadRecipients(): Promise<ActionResult<{
  recipients: RecipientRow[];
  summary: RecipientSummary;
  events: { id: string; name: string }[];
  tags: { id: string; name: string }[];
  stdId: string | null;
}>> {
  const ctx = await editor();
  if (!ctx) return noPermission();
  const { wedding, supabase } = ctx;

  const { data: std } = await supabase
    .from("save_the_dates")
    .select("id")
    .eq("wedding_id", wedding.id)
    .maybeSingle();

  const [households, guests, guestTags, eventInvites, rsvpResponses, events, tags, sends] =
    await Promise.all([
      fetchAll((f, t) =>
        supabase
          .from("households")
          .select("id, name, country, preferred_language")
          .eq("wedding_id", wedding.id)
          .order("name")
          .range(f, t),
      ),
      fetchAll((f, t) =>
        supabase
          .from("guests")
          .select("id, household_id, first_name, last_name, email, phone, side")
          .eq("wedding_id", wedding.id)
          .is("plus_one_of", null)
          .order("id")
          .range(f, t),
      ),
      fetchAll((f, t) =>
        supabase
          .from("guest_tags")
          .select("guest_id, tag_id")
          .eq("wedding_id", wedding.id)
          .order("id")
          .range(f, t),
      ),
      fetchAll((f, t) =>
        supabase
          .from("guest_event_invites")
          .select("guest_id, event_id")
          .eq("wedding_id", wedding.id)
          .order("id")
          .range(f, t),
      ),
      fetchAll((f, t) =>
        supabase
          .from("rsvp_responses")
          .select("guest_id, status")
          .eq("wedding_id", wedding.id)
          .order("id")
          .range(f, t),
      ),
      supabase
        .from("events")
        .select("id, name")
        .eq("wedding_id", wedding.id)
        .order("sort_order")
        .then((r) => r.data ?? []),
      supabase
        .from("tags")
        .select("id, name")
        .eq("wedding_id", wedding.id)
        .order("name")
        .then((r) => r.data ?? []),
      std
        ? fetchAll((f, t) =>
            supabase
              .from("save_the_date_sends")
              .select("id, household_id, method, method_override, status, token, to_address, error")
              .eq("save_the_date_id", std.id)
              .order("id")
              .range(f, t),
          )
        : Promise.resolve([]),
    ]);

  const guestTagMap = new Map<string, Set<string>>();
  for (const gt of guestTags) {
    const set = guestTagMap.get(gt.guest_id) ?? new Set();
    set.add(gt.tag_id);
    guestTagMap.set(gt.guest_id, set);
  }

  const guestEventMap = new Map<string, Set<string>>();
  for (const ge of eventInvites) {
    const set = guestEventMap.get(ge.guest_id) ?? new Set();
    set.add(ge.event_id);
    guestEventMap.set(ge.guest_id, set);
  }

  const declinedGuests = new Set<string>();
  const respondedGuests = new Set<string>();
  for (const r of rsvpResponses) {
    respondedGuests.add(r.guest_id);
    if (r.status === "declined") declinedGuests.add(r.guest_id);
  }

  const sendMap = new Map(sends.map((s) => [s.household_id, s]));

  const recipients: RecipientRow[] = [];
  for (const h of households) {
    const hGuests = guests.filter((g) => g.household_id === h.id);
    if (hGuests.length === 0) continue;

    const emails: string[] = [];
    const phones: string[] = [];
    const names: string[] = [];
    const tagIds = new Set<string>();
    const eventIds = new Set<string>();
    const sides = new Set<string>();
    let allDeclined = true;

    for (const g of hGuests) {
      names.push(`${g.first_name} ${g.last_name}`.trim());
      if (g.email) emails.push(g.email.trim().toLowerCase());
      if (g.phone) phones.push(g.phone.trim());
      sides.add(g.side);
      for (const tid of guestTagMap.get(g.id) ?? []) tagIds.add(tid);
      for (const eid of guestEventMap.get(g.id) ?? []) eventIds.add(eid);
      if (!respondedGuests.has(g.id) || !declinedGuests.has(g.id)) {
        allDeclined = false;
      }
    }
    if (hGuests.every((g) => respondedGuests.has(g.id) && declinedGuests.has(g.id))) {
      allDeclined = true;
    } else {
      allDeclined = false;
    }

    const send = sendMap.get(h.id);
    const uniqueEmails = [...new Set(emails)];
    const uniquePhones = [...new Set(phones)];

    let method: StdSendMethod | null = send?.method ?? null;
    if (!method && !send?.method_override) {
      if (uniqueEmails.length > 0) method = "email";
      else if (uniquePhones.length > 0) method = "sms";
    }

    recipients.push({
      householdId: h.id,
      householdName: h.name,
      country: h.country,
      language: h.preferred_language,
      guestNames: names,
      emails: uniqueEmails,
      phones: uniquePhones,
      side: sides.size === 1 ? [...sides][0] : "both",
      tags: [...tagIds],
      events: [...eventIds],
      declined: allDeclined,
      method,
      methodOverride: send?.method_override ?? false,
      status: send?.status ?? "not_sent",
      token: send?.token ?? null,
      sendId: send?.id ?? null,
      toAddress: send?.to_address ?? null,
      error: send?.error ?? null,
    });
  }

  const summary: RecipientSummary = {
    total: recipients.length,
    byEmail: recipients.filter((r) => r.method === "email").length,
    bySms: recipients.filter((r) => r.method === "sms").length,
    noContact: recipients.filter((r) => !r.method).length,
    alreadySent: recipients.filter((r) => r.status !== "not_sent").length,
    declined: recipients.filter((r) => r.declined).length,
  };

  return {
    ok: true,
    data: {
      recipients,
      summary,
      events,
      tags,
      stdId: std?.id ?? null,
    },
  };
}

export async function ensureRecipientSends(stdId: string): Promise<ActionResult<{ created: number }>> {
  const ctx = await editor();
  if (!ctx) return noPermission();
  const { wedding, supabase } = ctx;

  const households = await fetchAll((f, t) =>
    supabase
      .from("households")
      .select("id")
      .eq("wedding_id", wedding.id)
      .order("id")
      .range(f, t),
  );

  const existingSends = await fetchAll((f, t) =>
    supabase
      .from("save_the_date_sends")
      .select("household_id")
      .eq("save_the_date_id", stdId)
      .order("id")
      .range(f, t),
  );
  const existing = new Set(existingSends.map((s) => s.household_id));
  const missing = households.filter((h) => !existing.has(h.id));

  if (missing.length === 0) return { ok: true, data: { created: 0 } };

  for (let i = 0; i < missing.length; i += 500) {
    const batch = missing.slice(i, i + 500);
    const { error } = await supabase.from("save_the_date_sends").insert(
      batch.map((h) => ({
        wedding_id: wedding.id,
        save_the_date_id: stdId,
        household_id: h.id,
      })),
    );
    if (error) return fail("ensureRecipientSends", error);
  }

  revalidatePath("/app/save-the-date/recipients");
  return { ok: true, data: { created: missing.length } };
}

export async function updateSendMethod(
  sendId: string,
  method: StdSendMethod | null,
): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return noPermission();

  const { error } = await ctx.supabase
    .from("save_the_date_sends")
    .update({ method, method_override: true })
    .eq("id", sendId)
    .eq("wedding_id", ctx.wedding.id);

  if (error) return fail("updateSendMethod", error);
  return { ok: true };
}

export async function exportRecipientsCsv(): Promise<ActionResult<string>> {
  const result = await loadRecipients();
  if (!result.ok) return result;

  const rows = result.data.recipients;
  const header = "Household,Guests,Email,Phone,Side,Tags,Method,Status\n";
  const csv = rows
    .map((r) =>
      [
        csvEscape(r.householdName),
        csvEscape(r.guestNames.join("; ")),
        csvEscape(r.emails.join("; ")),
        csvEscape(r.phones.join("; ")),
        r.side,
        csvEscape(r.tags.join("; ")),
        r.method ?? "none",
        r.status,
      ].join(","),
    )
    .join("\n");

  return { ok: true, data: header + csv };
}

function csvEscape(s: string) {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// ---------- SD3: send emails ----------

export type StdSendSummary = {
  sent: number;
  failed: number;
  noEmail: string[];
};

function stdLocale(
  wedding: { languages: string[] },
  preferred: string | null | undefined,
): Locale {
  if (isLocale(preferred)) return preferred;
  const main = wedding.languages?.[0];
  return isLocale(main) ? main : "en";
}

export async function sendSaveTheDates(
  stdId: string,
): Promise<ActionResult<StdSendSummary>> {
  const user = await requireUser();
  const ctx = await editor();
  if (!ctx) return noPermission();
  const resend = getResend();
  if (!resend)
    return { ok: false, error: "Email is not configured (RESEND_API_KEY)." };

  const { wedding, supabase } = ctx;

  const { data: std } = await supabase
    .from("save_the_dates")
    .select("id, headline, subline, message, template, published, token")
    .eq("id", stdId)
    .eq("wedding_id", wedding.id)
    .single();

  if (!std) return { ok: false, error: "Save the Date not found." };
  if (!std.published)
    return { ok: false, error: "Publish the Save the Date first." };

  const sends = await fetchAll((f, t) =>
    supabase
      .from("save_the_date_sends")
      .select("id, household_id, method, token, status")
      .eq("save_the_date_id", stdId)
      .eq("method", "email")
      .eq("status", "not_sent")
      .order("id")
      .range(f, t),
  );

  if (sends.length === 0)
    return { ok: true, data: { sent: 0, failed: 0, noEmail: [] } };

  const householdIds = sends.map((s) => s.household_id);
  const households: {
    id: string;
    name: string;
    preferred_language: string | null;
  }[] = [];
  const guestEmails: { household_id: string; email: string }[] = [];

  for (let i = 0; i < householdIds.length; i += 100) {
    const batch = householdIds.slice(i, i + 100);
    const [h, g] = await Promise.all([
      supabase
        .from("households")
        .select("id, name, preferred_language")
        .eq("wedding_id", wedding.id)
        .in("id", batch),
      supabase
        .from("guests")
        .select("id, household_id, email")
        .eq("wedding_id", wedding.id)
        .in("household_id", batch)
        .is("plus_one_of", null)
        .not("email", "is", null)
        .eq("email_unsubscribed", false),
    ]);
    if (h.error || g.error) return fail("sendSaveTheDates", h.error ?? g.error);
    households.push(...h.data);
    for (const guest of g.data) {
      if (guest.email) guestEmails.push({ household_id: guest.household_id, email: guest.email.trim().toLowerCase() });
    }
  }

  const emailsByHousehold = new Map<string, string[]>();
  for (const ge of guestEmails) {
    const list = emailsByHousehold.get(ge.household_id) ?? [];
    if (!list.includes(ge.email)) list.push(ge.email);
    emailsByHousehold.set(ge.household_id, list);
  }

  const householdMap = new Map(households.map((h) => [h.id, h]));
  const sendMap = new Map(sends.map((s) => [s.household_id, s]));
  const couple = `${wedding.partner_a_name} & ${wedding.partner_b_name}`;
  const siteUrl = await getSiteUrl();
  const { accent } = await import("@/lib/save-the-date/templates").then((m) => {
    const tpl = m.STD_TEMPLATES[std.template as keyof typeof m.STD_TEMPLATES];
    return { accent: tpl?.accent ?? "#C4A265" };
  });

  let sent = 0;
  let failed = 0;
  const noEmail: string[] = [];

  const sendable = sends.filter((s) => {
    const h = householdMap.get(s.household_id);
    if (!h) return false;
    if (!emailsByHousehold.has(s.household_id)) {
      noEmail.push(h.name);
      return false;
    }
    return true;
  });

  for (let i = 0; i < sendable.length; i += 100) {
    const chunk = sendable.slice(i, i + 100);
    const messages = await Promise.all(
      chunk.map(async (send) => {
        const h = householdMap.get(send.household_id)!;
        const locale = stdLocale(wedding, h.preferred_language);
        const t = await getTranslations({ locale, namespace: "stdEmail" });
        const link = `${siteUrl}/s/${send.token}`;
        const dateText = wedding.wedding_date
          ? fmtDate(wedding.wedding_date, locale, "long")
          : null;
        const props: StdEmailProps = {
          lang: locale,
          rtl: isRtl(locale),
          text: {
            preview: t("preview", { couple }),
            eyebrow: t("eyebrow"),
            heading: t("heading"),
            body: t("body", { couple }),
            button: t("button"),
            fallback: t("fallback", { link }),
            love: t("love"),
            personal: t("personal"),
          },
          couple,
          dateText,
          location: wedding.location,
          message: std.message,
          link,
          accentColor: accent,
        };
        const element = SaveTheDateEmail(props);
        return {
          from: emailFrom(couple),
          to: emailsByHousehold.get(send.household_id)!,
          replyTo: user.email,
          subject: t("subject", { couple }),
          html: await render(element),
          text: await render(element, { plainText: true }),
        };
      }),
    );

    const { data, error } = await resend.batch.send(messages);
    const ids = data?.data ?? [];
    if (error) console.error("[sendSaveTheDates] Resend error", error);

    for (let j = 0; j < chunk.length; j++) {
      const send = chunk[j];
      const resendId = error ? null : (ids[j]?.id ?? null);
      const h = householdMap.get(send.household_id)!;
      const emails = emailsByHousehold.get(send.household_id)!;

      const { error: updateErr } = await supabase
        .from("save_the_date_sends")
        .update({
          status: error ? "failed" : "sent",
          resend_id: resendId,
          to_address: emails[0],
          sent_at: new Date().toISOString(),
          error: error ? error.message.slice(0, 500) : null,
        })
        .eq("id", send.id);

      if (updateErr) console.error("[sendSaveTheDates] update", updateErr);
    }

    if (error) failed += chunk.length;
    else sent += chunk.length;
  }

  revalidatePath("/app/save-the-date/recipients");
  return { ok: true, data: { sent, failed, noEmail } };
}

// ---------- SD4: send SMS ----------

export type SmsSendSummary = {
  sent: number;
  failed: number;
  noPhone: string[];
};

export async function sendSaveTheDateSms(
  stdId: string,
): Promise<ActionResult<SmsSendSummary>> {
  const ctx = await editor();
  if (!ctx) return noPermission();

  const { getTwilio, twilioFrom } = await import("@/lib/sms/twilio");
  const tw = getTwilio();
  if (!tw)
    return { ok: false, error: "SMS is not configured (TWILIO_ACCOUNT_SID)." };

  const { wedding, supabase } = ctx;

  const { data: std } = await supabase
    .from("save_the_dates")
    .select("id, headline, message, published")
    .eq("id", stdId)
    .eq("wedding_id", wedding.id)
    .single();

  if (!std) return { ok: false, error: "Save the Date not found." };
  if (!std.published)
    return { ok: false, error: "Publish the Save the Date first." };

  const sends = await fetchAll((f, t) =>
    supabase
      .from("save_the_date_sends")
      .select("id, household_id, token, status")
      .eq("save_the_date_id", stdId)
      .eq("method", "sms")
      .eq("status", "not_sent")
      .order("id")
      .range(f, t),
  );

  if (sends.length === 0)
    return { ok: true, data: { sent: 0, failed: 0, noPhone: [] } };

  const householdIds = sends.map((s) => s.household_id);
  const households: { id: string; name: string }[] = [];
  const guestPhones: { household_id: string; phone: string }[] = [];

  for (let i = 0; i < householdIds.length; i += 100) {
    const batch = householdIds.slice(i, i + 100);
    const [h, g] = await Promise.all([
      supabase
        .from("households")
        .select("id, name")
        .eq("wedding_id", wedding.id)
        .in("id", batch),
      supabase
        .from("guests")
        .select("id, household_id, phone")
        .eq("wedding_id", wedding.id)
        .in("household_id", batch)
        .is("plus_one_of", null)
        .not("phone", "is", null),
    ]);
    if (h.error || g.error) return fail("sendSaveTheDateSms", h.error ?? g.error);
    households.push(...h.data);
    for (const guest of g.data) {
      if (guest.phone?.trim()) {
        guestPhones.push({
          household_id: guest.household_id,
          phone: guest.phone.trim(),
        });
      }
    }
  }

  const phoneByHousehold = new Map<string, string>();
  for (const gp of guestPhones) {
    if (!phoneByHousehold.has(gp.household_id)) {
      phoneByHousehold.set(gp.household_id, gp.phone);
    }
  }

  const householdMap = new Map(households.map((h) => [h.id, h]));
  const couple = `${wedding.partner_a_name} & ${wedding.partner_b_name}`;
  const siteUrl = await getSiteUrl();
  const statusCallback = `${siteUrl}/api/twilio/webhook`;
  const from = twilioFrom();

  let sent = 0;
  let failed = 0;
  const noPhone: string[] = [];

  for (const send of sends) {
    const h = householdMap.get(send.household_id);
    if (!h) continue;
    const phone = phoneByHousehold.get(send.household_id);
    if (!phone) {
      noPhone.push(h.name);
      continue;
    }

    const link = `${siteUrl}/s/${send.token}`;
    const body = `${couple} — Save the Date!\n${link}`;

    try {
      const msg = await tw.messages.create({
        from,
        to: phone,
        body,
        statusCallback,
      });

      await supabase
        .from("save_the_date_sends")
        .update({
          status: "sent",
          resend_id: msg.sid,
          to_address: phone,
          sent_at: new Date().toISOString(),
        })
        .eq("id", send.id);

      sent++;
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error ? err.message.slice(0, 500) : "Unknown error";
      console.error("[sendSaveTheDateSms]", errMsg);

      await supabase
        .from("save_the_date_sends")
        .update({
          status: "failed",
          to_address: phone,
          error: errMsg,
        })
        .eq("id", send.id);

      failed++;
    }
  }

  revalidatePath("/app/save-the-date/recipients");
  return { ok: true, data: { sent, failed, noPhone } };
}

export async function getSmsEstimate(stdId: string): Promise<ActionResult<{ count: number; segments: number }>> {
  const ctx = await editor();
  if (!ctx) return noPermission();
  const { wedding, supabase } = ctx;

  const sends = await fetchAll((f, t) =>
    supabase
      .from("save_the_date_sends")
      .select("id")
      .eq("save_the_date_id", stdId)
      .eq("method", "sms")
      .eq("status", "not_sent")
      .order("id")
      .range(f, t),
  );

  const couple = `${wedding.partner_a_name} & ${wedding.partner_b_name}`;
  const sampleBody = `${couple} — Save the Date!\nhttps://example.com/s/abc123def456789a`;
  const { estimateSegments } = await import("@/lib/sms/twilio");
  const segments = estimateSegments(sampleBody);

  return { ok: true, data: { count: sends.length, segments } };
}
