"use server";

import { createClient as createPlainClient } from "@supabase/supabase-js";
import { rememberAppLocale } from "@/lib/i18n/remember";
import { redirect } from "next/navigation";
import { z } from "zod";
import { v } from "@/lib/i18n/validation";
import type { ActionResult } from "@/lib/action-result";
import { getSiteUrl, safeNextPath } from "@/lib/site-url";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { fail, err, invalid } from "@/lib/errors";

function callbackUrl(siteUrl: string, next: string) {
  return `${siteUrl}/auth/callback?next=${encodeURIComponent(safeNextPath(next))}`;
}

const magicLinkSchema = z.object({
  email: z.email(v("email")),
  next: z.string().optional(),
});

/**
 * Emails the user a one-click sign-in link (creates the account if new).
 *
 * The link carries the sign-in itself ("implicit" flow), so it works in any
 * browser: on phones, email apps often open links in their own browser, where
 * the default flow (which needs a secret kept in the requesting browser) fails.
 * /auth/confirm finishes the sign-in and sets the session cookies.
 */
export async function sendMagicLink(input: unknown): Promise<ActionResult> {
  const parsed = magicLinkSchema.safeParse(input);
  if (!parsed.success) return await invalid(parsed.error);

  const supabase = createPlainClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      flowType: "implicit",
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const next = safeNextPath(parsed.data.next ?? "/app");
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: `${await getSiteUrl()}/auth/confirm?next=${encodeURIComponent(next)}` },
  });

  if (error) {
    if (error.status === 429) {
      return await err("tooManyEmails");
    }
    return fail("sendMagicLink", error, "emailNotSent");
  }
  return { ok: true };
}

const codeSchema = z.object({
  email: z.email(),
  code: z
    .string()
    .trim()
    .regex(/^\d{6,10}$/, v("code")),
});

/**
 * Signs in with the numeric code from the email (a backup for the link:
 * works on any device and can't be "used up" by email link scanners).
 */
export async function verifyEmailCode(input: unknown): Promise<ActionResult> {
  const parsed = codeSchema.safeParse(input);
  if (!parsed.success) return await invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.code,
    type: "email",
  });
  if (error) {
    console.error("[verifyEmailCode]", error);
    return await err("codeWrong");
  }
  await rememberAppLocale(supabase);
  return { ok: true };
}

const tokensSchema = z.object({
  access_token: z.string().min(20).max(8000),
  refresh_token: z.string().min(5).max(2000),
});

/**
 * Finishes a sign-in link (see sendMagicLink): Supabase checks the tokens from
 * the link, and the session is saved in this browser's cookies.
 */
export async function finishLinkSignIn(input: unknown): Promise<ActionResult> {
  const parsed = tokensSchema.safeParse(input);
  if (!parsed.success) return await err("codeWrong");
  const supabase = await createClient();
  const { error } = await supabase.auth.setSession(parsed.data);
  if (error) {
    console.error("[finishLinkSignIn]", error);
    return await err("codeWrong");
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
