"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { fetchHotelPreview } from "@/lib/hotels/fetch-link-preview";
import { createClient } from "@/lib/supabase/server";
import { canEdit, requireWedding } from "@/lib/wedding";
import { fail, invalid, noPermission } from "@/lib/errors";
import { v } from "@/lib/i18n/validation";

async function editor() {
  const { wedding, role } = await requireWedding();
  if (!canEdit(role)) return null;
  return { wedding, sb: await createClient() };
}

const price = z.number().finite().min(0, v("negative")).max(9_999_999_999).nullable();

/**
 * Pastes a hotel link: reads the page (name, photo, stars, score, address,
 * sometimes a price) and puts the hotel on the shortlist.
 */
export async function addHotelFromLink(
  rawUrl: string,
  pricePerNight: number | null,
): Promise<ActionResult<{ id: string; name: string; fetched: boolean }>> {
  const ctx = await editor();
  if (!ctx) return noPermission();
  const t = await getTranslations("hotelShortlist");
  const url = z
    .url({ protocol: /^https?$/ })
    .max(500)
    .safeParse(rawUrl.trim());
  if (!url.success) return { ok: false, error: t("linkInvalid") };
  const p = price.safeParse(pricePerNight);
  if (!p.success) return await invalid(p.error);

  const { preview, fetched } = await fetchHotelPreview(url.data);
  const { data, error } = await ctx.sb
    .from("hotels")
    .insert({
      wedding_id: ctx.wedding.id,
      name: preview.name,
      status: "considering",
      booking_url: url.data,
      address: preview.address,
      image_url: preview.imageUrl,
      stars: preview.stars,
      review_score: preview.reviewScore,
      price_per_night: p.data ?? preview.pricePerNight,
      shortlisted: true,
    })
    .select("id")
    .single();
  if (error) return fail("addHotelFromLink", error);
  revalidatePath("/app/hotels");
  return { ok: true, data: { id: data.id, name: preview.name, fetched } };
}

export async function setHotelShortlisted(id: string, shortlisted: boolean): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !z.uuid().safeParse(id).success) return noPermission();
  const { error } = await ctx.sb
    .from("hotels")
    .update({ shortlisted: shortlisted === true })
    .eq("id", id)
    .eq("wedding_id", ctx.wedding.id);
  if (error) return fail("setHotelShortlisted", error);
  revalidatePath("/app/hotels");
  return { ok: true };
}

const detailsSchema = z.object({
  pricePerNight: price,
  stars: z.number().int().min(1).max(5).nullable(),
  reviewScore: z.number().min(0).max(10).nullable(),
  imageUrl: z.union([z.literal(""), z.url({ protocol: /^https$/ }).max(1000)]),
});

/** The comparison details of one hotel, edited on its shortlist card. */
export async function saveShortlistDetails(id: string, input: unknown): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !z.uuid().safeParse(id).success) return noPermission();
  const parsed = detailsSchema.safeParse(input);
  if (!parsed.success) return await invalid(parsed.error);
  const d = parsed.data;
  const { error } = await ctx.sb
    .from("hotels")
    .update({
      price_per_night: d.pricePerNight,
      stars: d.stars,
      review_score: d.reviewScore == null ? null : Math.round(d.reviewScore * 10) / 10,
      image_url: d.imageUrl || null,
    })
    .eq("id", id)
    .eq("wedding_id", ctx.wedding.id);
  if (error) return fail("saveShortlistDetails", error);
  revalidatePath("/app/hotels");
  return { ok: true };
}
