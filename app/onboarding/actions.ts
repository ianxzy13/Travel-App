"use server";

import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import type { ActionResult } from "@/lib/action-result";
import type { Json } from "@/lib/database.types";
import { fail, invalid } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { toWeddingColumns, weddingSchema } from "@/lib/validation/wedding";
import { requireUser, setCurrentWedding } from "@/lib/wedding";

/** Creates a wedding (the user becomes its owner) and opens the dashboard. */
export async function createWedding(input: unknown): Promise<ActionResult> {
  await requireUser();
  const parsed = weddingSchema.safeParse(input);
  if (!parsed.success) return await invalid(parsed.error);

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

  if (error || !weddingId) return fail("createWedding", error, "weddingNotCreated");

  await startInOwnLanguage(supabase, weddingId);
  await setCurrentWedding(weddingId);
  redirect("/app?welcome=1");
}

/**
 * A new wedding starts in the creator's language: it becomes the couple's
 * language, and the starter texts the database adds in English (event names,
 * website greeting and sample questions) are replaced. Failures only log.
 */
async function startInOwnLanguage(sb: Awaited<ReturnType<typeof createClient>>, weddingId: string) {
  const locale = await getLocale();
  const { error } = await sb
    .from("weddings")
    .update({ languages: [locale] })
    .eq("id", weddingId);
  if (error) console.error("[createWedding languages]", error);
  if (locale === "en") return;

  const t = await getTranslations("onboarding.defaults");
  const renames = [
    ["Ceremony", t("ceremony")],
    ["Reception", t("reception")],
  ];
  for (const [from, to] of renames) {
    await sb.from("events").update({ name: to }).eq("wedding_id", weddingId).eq("name", from);
  }

  const { data: sections } = await sb
    .from("website_sections")
    .select("id, kind, content")
    .eq("wedding_id", weddingId)
    .in("kind", ["home", "rsvp", "faq"]);
  const faq = [t("faqChildren"), t("faqParking"), t("faqWear")];
  for (const s of sections ?? []) {
    const content = { ...(s.content as Record<string, unknown>) };
    if (s.kind === "home") content.tagline = t("tagline");
    if (s.kind === "rsvp") content.intro = t("rsvpIntro");
    if (s.kind === "faq" && Array.isArray(content.items)) {
      content.items = (content.items as { question: string }[]).map((item, i) => ({
        ...item,
        question: faq[i] ?? item.question,
      }));
    }
    await sb
      .from("website_sections")
      .update({ content: content as Json })
      .eq("id", s.id);
  }
}
