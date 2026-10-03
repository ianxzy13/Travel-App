"use server";

import { getTranslations } from "next-intl/server";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { guestFlightsSchema } from "@/lib/validation/rsvp";

const slugSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9-]{3,60}$/);
const codeSchema = z.string().trim().min(6).max(10);

/** A guest sends their flights from the wedding website. */
export async function submitGuestFlights(
  slug: string,
  code: string,
  payload: unknown,
): Promise<ActionResult> {
  const t = await getTranslations("flightForm");
  const s = slugSchema.safeParse(slug);
  const c = codeSchema.safeParse(code);
  if (!s.success || !c.success) return { ok: false, error: t("notFound") };
  const parsed = guestFlightsSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: t("error") };

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_guest_flights", {
    p_slug: s.data,
    p_code: c.data,
    p_payload: parsed.data,
  });
  if (error) {
    console.error("[submitGuestFlights]", error);
    return {
      ok: false,
      error: error.message.includes("rsvp_not_found") ? t("notFound") : t("error"),
    };
  }
  return { ok: true };
}
