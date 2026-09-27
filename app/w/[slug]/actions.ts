"use server";

import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import type { ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { siteCookie } from "@/lib/website/cookie";

/** Checks the website password; on success remembers it for 30 days. */
export async function unlockSite(slug: string, password: string): Promise<ActionResult> {
  // the message is in the visitor's language (this request comes from /w/<slug>)
  const t = await getTranslations("site.password");
  if (!password || password.length > 100) return { ok: false, error: t("wrong") };
  const sb = await createClient();
  const { data: token, error } = await sb.rpc("unlock_site", {
    p_slug: slug,
    p_password: password,
  });
  if (error) console.error("[unlockSite]", error);
  if (!token) {
    // slow down guessing a little
    await new Promise((r) => setTimeout(r, 600));
    return { ok: false, error: t("wrong") };
  }
  (await cookies()).set(siteCookie(slug), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return { ok: true };
}
