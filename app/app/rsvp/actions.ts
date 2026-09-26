"use server";

import { render } from "@react-email/components";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { RsvpEmail, type RsvpEmailProps } from "@/emails/rsvp-email";
import { fail, type ActionResult } from "@/lib/action-result";
import { emailFrom, getResend } from "@/lib/email/resend";
import { formatWeddingDate } from "@/lib/format";
import { rsvpErrorMessage, type RsvpData, type RsvpResult } from "@/lib/rsvp/types";
import { getSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import {
  mealOptionSchema,
  rsvpPayloadSchema,
  rsvpSettingsSchema,
  sendEmailSchema,
} from "@/lib/validation/rsvp";
import { canEdit, coupleName, requireUser, requireWedding } from "@/lib/wedding";

const NO_PERMISSION = { ok: false as const, error: "You don't have permission to do that." };

async function editor() {
  const { wedding, role } = await requireWedding();
  if (!canEdit(role)) return null;
  return { wedding, supabase: await createClient() };
}

function done(): ActionResult {
  revalidatePath("/app", "layout");
  return { ok: true };
}

// ---------- settings ----------

export async function updateRsvpSettings(input: unknown): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  const parsed = rsvpSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  const { error } = await ctx.supabase
    .from("weddings")
    .update({
      rsvp_deadline: v.deadline || null,
      rsvp_contact: v.contact || null,
      rsvp_ask_song: v.askSong,
      rsvp_notify_email: v.notifyEmail,
    })
    .eq("id", ctx.wedding.id);
  if (error) return fail("updateRsvpSettings", error);
  return done();
}

export async function saveMealOption(input: unknown, id?: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  const parsed = mealOptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const row = { name: parsed.data.name, description: parsed.data.description || null };

  const { error } = id
    ? await ctx.supabase
        .from("meal_options")
        .update(row)
        .eq("id", id)
        .eq("wedding_id", ctx.wedding.id)
    : // new options appear last (they are ordered by sort_order, then creation time)
      await ctx.supabase.from("meal_options").insert({ ...row, wedding_id: ctx.wedding.id });
  if (error) return fail("saveMealOption", error);
  return done();
}

export async function deleteMealOption(id: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  const { error } = await ctx.supabase
    .from("meal_options")
    .delete()
    .eq("id", id)
    .eq("wedding_id", ctx.wedding.id);
  if (error) return fail("deleteMealOption", error);
  return done();
}

export async function setEventMealChoice(eventId: string, on: boolean): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  const { error } = await ctx.supabase
    .from("events")
    .update({ meal_choice: on })
    .eq("id", eventId)
    .eq("wedding_id", ctx.wedding.id);
  if (error) return fail("setEventMealChoice", error);
  return done();
}

// ---------- recording a reply for a household (paper / phone RSVPs) ----------

export async function loadHouseholdRsvp(code: string): Promise<ActionResult<RsvpData>> {
  await requireWedding();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_rsvp", { p_code: code });
  if (error || !data) return fail("loadHouseholdRsvp", error, "We couldn't load this household.");
  return { ok: true, data: data as RsvpData };
}

export async function recordRsvp(
  code: string,
  payload: unknown,
): Promise<ActionResult<RsvpResult>> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  const parsed = rsvpPayloadSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { data, error } = await ctx.supabase.rpc("submit_rsvp", {
    p_code: code,
    p_payload: parsed.data,
    p_as_couple: true,
  });
  if (error || !data) {
    console.error("[recordRsvp]", error);
    return { ok: false, error: rsvpErrorMessage(error?.message) };
  }
  done();
  return { ok: true, data: data as RsvpResult };
}

// ---------- invitation & reminder emails ----------

type Kind = "invitation" | "reminder";

function emailProps(
  wedding: Awaited<ReturnType<typeof requireWedding>>["wedding"],
  kind: Kind,
  note: string,
  household: { name: string; code: string },
  siteUrl: string,
): RsvpEmailProps {
  return {
    kind,
    couple: coupleName(wedding),
    householdName: household.name,
    dateText: wedding.wedding_date
      ? formatWeddingDate(wedding.wedding_date, "EEEE d MMMM yyyy")
      : null,
    location: wedding.location,
    deadlineText: wedding.rsvp_deadline
      ? formatWeddingDate(wedding.rsvp_deadline, "d MMMM yyyy")
      : null,
    link: `${siteUrl}/r/${household.code}`,
    code: household.code,
    note,
    accent: wedding.accent,
  };
}

function subjectFor(kind: Kind, couple: string) {
  return kind === "invitation"
    ? `You're invited: ${couple}'s wedding`
    : `Reminder: please RSVP for ${couple}'s wedding`;
}

/** Renders the email as HTML for the preview in the send dialog. */
export async function previewRsvpEmail(
  kind: Kind,
  note: string,
): Promise<ActionResult<{ html: string; subject: string }>> {
  const { wedding } = await requireWedding();
  const props = emailProps(
    wedding,
    kind,
    note.slice(0, 1000),
    { name: "The Smith Family", code: "K7P2QX" },
    await getSiteUrl(),
  );
  const html = await render(RsvpEmail(props));
  return { ok: true, data: { html, subject: subjectFor(kind, props.couple) } };
}

export type SendSummary = {
  sent: number;
  failed: number;
  /** household names that have nobody with an email address */
  noEmail: string[];
};

/** Sends one email per household (to everyone in it with an email) and logs it. */
export async function sendRsvpEmails(input: unknown): Promise<ActionResult<SendSummary>> {
  const user = await requireUser();
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  const parsed = sendEmailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const resend = getResend();
  if (!resend)
    return { ok: false, error: "Email isn't set up yet. Add RESEND_API_KEY (see the README)." };

  const { householdIds, kind, note } = parsed.data;
  const { wedding, supabase } = ctx;

  // Load households + guest emails (in batches: ids go in the URL).
  const households: { id: string; name: string; rsvp_code: string }[] = [];
  const guests: { household_id: string; email: string | null }[] = [];
  for (let i = 0; i < householdIds.length; i += 100) {
    const batch = householdIds.slice(i, i + 100);
    const [h, g] = await Promise.all([
      supabase
        .from("households")
        .select("id, name, rsvp_code")
        .eq("wedding_id", wedding.id)
        .in("id", batch),
      supabase
        .from("guests")
        .select("household_id, email")
        .eq("wedding_id", wedding.id)
        .in("household_id", batch)
        .is("plus_one_of", null)
        .not("email", "is", null),
    ]);
    if (h.error || g.error) return fail("sendRsvpEmails", h.error ?? g.error);
    households.push(...h.data);
    guests.push(...g.data);
  }

  const emailsByHousehold = new Map<string, string[]>();
  for (const g of guests) {
    const email = g.email?.trim().toLowerCase();
    if (!email) continue;
    const list = emailsByHousehold.get(g.household_id) ?? [];
    if (!list.includes(email)) list.push(email);
    emailsByHousehold.set(g.household_id, list);
  }

  const noEmail = households.filter((h) => !emailsByHousehold.has(h.id)).map((h) => h.name);
  const sendable = households.filter((h) => emailsByHousehold.has(h.id));
  const siteUrl = await getSiteUrl();
  const couple = coupleName(wedding);
  let sent = 0;
  let failed = 0;

  // Resend accepts up to 100 emails per batch request.
  for (let i = 0; i < sendable.length; i += 100) {
    const chunk = sendable.slice(i, i + 100);
    const messages = await Promise.all(
      chunk.map(async (h) => {
        const element = RsvpEmail(
          emailProps(wedding, kind, note, { name: h.name, code: h.rsvp_code }, siteUrl),
        );
        return {
          from: emailFrom(couple),
          to: emailsByHousehold.get(h.id)!,
          replyTo: user.email,
          subject: subjectFor(kind, couple),
          html: await render(element),
          text: await render(element, { plainText: true }),
        };
      }),
    );

    const { data, error } = await resend.batch.send(messages);
    const ids = data?.data ?? [];
    if (error) console.error("[sendRsvpEmails] Resend error", error);

    const rows = chunk.map((h, idx) => ({
      wedding_id: wedding.id,
      household_id: h.id,
      kind,
      to_emails: emailsByHousehold.get(h.id)!,
      resend_id: error ? null : (ids[idx]?.id ?? null),
      status: error ? ("failed" as const) : ("sent" as const),
      error: error ? error.message.slice(0, 500) : null,
      sent_by: user.id,
    }));
    const { error: logError } = await supabase.from("email_sends").insert(rows);
    if (logError) console.error("[sendRsvpEmails] log", logError);

    if (error) failed += chunk.length;
    else sent += chunk.length;
  }

  revalidatePath("/app/rsvp");
  if (sent === 0 && failed > 0) {
    return {
      ok: false,
      error:
        "Resend refused the emails. Without a verified domain you can only send to your own email address (see the README).",
    };
  }
  return { ok: true, data: { sent, failed, noEmail } };
}

// ---------- notifications ----------

export async function markNotificationsRead(ids?: string[]): Promise<ActionResult> {
  const user = await requireUser();
  const { wedding } = await requireWedding();
  const supabase = await createClient();
  let query = supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("wedding_id", wedding.id)
    .is("read_at", null);
  if (ids) {
    if (!z.array(z.uuid()).max(100).safeParse(ids).success) return NO_PERMISSION;
    query = query.in("id", ids);
  }
  const { error } = await query;
  if (error) return fail("markNotificationsRead", error);
  revalidatePath("/app", "layout");
  return { ok: true };
}
