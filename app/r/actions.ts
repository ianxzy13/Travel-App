"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { emailFrom, getResend } from "@/lib/email/resend";
import { rsvpErrorMessage, type RsvpResult } from "@/lib/rsvp/types";
import { getSiteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { rsvpPayloadSchema } from "@/lib/validation/rsvp";

// These actions are used by guests WITHOUT an account. They only call the
// get_rsvp / submit_rsvp / find_rsvp_code database functions, which check the
// household code and never expose other households.

const codeSchema = z.string().trim().min(6).max(10);

export async function submitRsvp(
  code: string,
  payload: unknown,
): Promise<ActionResult<RsvpResult>> {
  const parsedCode = codeSchema.safeParse(code);
  const parsed = rsvpPayloadSchema.safeParse(payload);
  if (!parsedCode.success) return { ok: false, error: rsvpErrorMessage("rsvp_not_found") };
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_rsvp", {
    p_code: parsedCode.data,
    p_payload: parsed.data,
  });
  if (error || !data) {
    console.error("[submitRsvp]", error);
    return { ok: false, error: rsvpErrorMessage(error?.message) };
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
    .select("partner_a_name, partner_b_name, rsvp_notify_email")
    .eq("id", result.wedding_id)
    .single();
  if (!wedding?.rsvp_notify_email) return;

  const { data: members } = await admin
    .from("wedding_members")
    .select("role, profile:profiles(email)")
    .eq("wedding_id", result.wedding_id)
    .in("role", ["owner", "editor"]);
  const to = (members ?? []).flatMap((m) => (m.profile?.email ? [m.profile.email] : []));
  if (to.length === 0) return;

  const link = `${await getSiteUrl()}/app/rsvp?household=${result.household_id}`;
  const what = result.updated ? "updated their RSVP" : "replied";
  const summary = `${result.attending} attending, ${result.declined} not attending`;
  await resend.emails.send({
    from: emailFrom("Vow"),
    to,
    subject: `${result.household_name} ${what}`,
    text: `${result.household_name} ${what}: ${summary}.\n\nSee all replies: ${link}`,
    html: `<p><strong>${escapeHtml(result.household_name)}</strong> ${what}: ${summary}.</p><p><a href="${link}">See all replies</a></p>`,
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** "Find your invitation": full name → RSVP code (or a friendly error). */
export async function findInvitation(
  slug: string,
  name: string,
): Promise<ActionResult<{ code: string }>> {
  const cleanName = name.trim().replace(/\s+/g, " ");
  if (cleanName.split(" ").length < 2) {
    return { ok: false, error: "Please enter your first and last name, as on your invitation." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("find_rsvp_code", {
    p_slug: slug.slice(0, 60),
    p_name: cleanName.slice(0, 160),
  });
  if (error) {
    console.error("[findInvitation]", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
  if (!data) {
    return {
      ok: false,
      error:
        "We couldn't find that name. Try the spelling on your invitation, or use the code from your invitation.",
    };
  }
  return { ok: true, data: { code: data } };
}
