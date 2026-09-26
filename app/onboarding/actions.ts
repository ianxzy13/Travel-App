"use server";

import { redirect } from "next/navigation";
import { fail, type ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { toWeddingColumns, weddingSchema } from "@/lib/validation/wedding";
import { requireUser, setCurrentWedding } from "@/lib/wedding";

/** Creates a wedding (the user becomes its owner) and opens the dashboard. */
export async function createWedding(input: unknown): Promise<ActionResult> {
  await requireUser();
  const parsed = weddingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const c = toWeddingColumns(parsed.data);
  const supabase = await createClient();
  const { data: weddingId, error } = await supabase.rpc("create_wedding", {
    p_partner_a_name: c.partner_a_name,
    p_partner_b_name: c.partner_b_name,
    p_wedding_date: c.wedding_date,
    p_location: c.location,
    p_currency: c.currency,
    p_estimated_guests: c.estimated_guests,
    p_style_tags: c.style_tags,
    p_accent: c.accent,
  });

  if (error || !weddingId) return fail("createWedding", error, "We couldn't create your wedding.");

  await setCurrentWedding(weddingId);
  redirect("/app?welcome=1");
}
