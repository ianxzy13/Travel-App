"use server";

import { rememberAppLocale } from "@/lib/i18n/remember";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, type ActionResult } from "@/lib/action-result";
import { getSiteUrl, safeNextPath } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

function callbackUrl(siteUrl: string, next: string) {
  return `${siteUrl}/auth/callback?next=${encodeURIComponent(safeNextPath(next))}`;
}

const magicLinkSchema = z.object({
  email: z.email("Please enter a valid email address"),
  next: z.string().optional(),
});

/** Emails the user a one-click sign-in link (creates the account if new). */
export async function sendMagicLink(input: unknown): Promise<ActionResult> {
  const parsed = magicLinkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: callbackUrl(await getSiteUrl(), parsed.data.next ?? "/app") },
  });

  if (error) {
    if (error.status === 429) {
      return { ok: false, error: "Too many emails sent. Please wait a minute and try again." };
    }
    return fail("sendMagicLink", error, "We couldn't send the email. Please try again.");
  }
  return { ok: true };
}

const codeSchema = z.object({
  email: z.email(),
  code: z
    .string()
    .trim()
    .regex(/^\d{6,10}$/, "Please enter the code from the email (numbers only)"),
});

/**
 * Signs in with the numeric code from the email (a backup for the link:
 * works on any device and can't be "used up" by email link scanners).
 */
export async function verifyEmailCode(input: unknown): Promise<ActionResult> {
  const parsed = codeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.code,
    type: "email",
  });
  if (error) {
    console.error("[verifyEmailCode]", error);
    return { ok: false, error: "That code is wrong or has expired. Please request a new email." };
  }
  await rememberAppLocale(supabase);
  return { ok: true };
}

/** Starts "Continue with Google": sends the browser to Google's sign-in page. */
export async function signInWithGoogle(formData: FormData) {
  const next = safeNextPath(formData.get("next")?.toString());
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl(await getSiteUrl(), next) },
  });

  if (error || !data.url) {
    console.error("[signInWithGoogle]", error);
    redirect(`/login?error=google&next=${encodeURIComponent(next)}`);
  }
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
