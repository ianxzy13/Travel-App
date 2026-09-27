"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import type { VenueKind } from "@/lib/database.types";
import { isOwnFile, removeFiles } from "@/lib/files";
import { contentTranslations } from "@/lib/i18n/content-locale";
import { VISIT_QUESTION_KEYS } from "@/lib/places/labels";
import { createClient } from "@/lib/supabase/server";
import { checklistItemSchema, venueSchema } from "@/lib/validation/places";
import { canEdit, requireWedding } from "@/lib/wedding";
import { fail, err, invalid, noPermission } from "@/lib/errors";

const idSchema = z.uuid();

async function editor() {
  const { wedding, role } = await requireWedding();
  if (!canEdit(role)) return null;
  return { wedding, sb: await createClient() };
}

function done(): ActionResult {
  revalidatePath("/app/venues");
  revalidatePath("/app/seating");
  revalidatePath("/app/settings");
  revalidatePath("/app");
  return { ok: true };
}

type Sb = Awaited<ReturnType<typeof createClient>>;

/**
 * Only one booked venue per role: booking a "reception" venue moves any other
 * booked venue that also covers the reception back to "shortlisted".
 */
async function releaseOtherBookings(sb: Sb, weddingId: string, keepId: string, kind: VenueKind) {
  const overlapping: VenueKind[] =
    kind === "both" ? ["ceremony", "reception", "both"] : [kind, "both"];
  await sb
    .from("venues")
    .update({ status: "shortlisted" })
    .eq("wedding_id", weddingId)
    .eq("status", "booked")
    .in("kind", overlapping)
    .neq("id", keepId);
}

export async function saveVenue(
  input: unknown,
  id?: string,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await editor();
  if (!ctx) return noPermission();
  const parsed = venueSchema.safeParse(input);
  if (!parsed.success) return await invalid(parsed.error);
  const v = parsed.data;
  const wid = ctx.wedding.id;
  if (!v.photoPaths.every((p) => isOwnFile(p, wid))) return noPermission();

  const row = {
    name: v.name,
    kind: v.kind,
    status: v.status,
    availability: v.availability,
    address: v.address || null,
    contact_name: v.contactName || null,
    phone: v.phone || null,
    email: v.email || null,
    website: v.website || null,
    capacity: v.capacity,
    price: v.price,
    included: v.included || null,
    pros: v.pros || null,
    cons: v.cons || null,
    notes: v.notes || null,
    rating: v.rating,
    visit_date: v.visitDate || null,
    photo_paths: v.photoPaths,
  };

  let venueId = id;
  if (venueId) {
    const { data: old } = await ctx.sb
      .from("venues")
      .select("photo_paths")
      .eq("id", venueId)
      .eq("wedding_id", wid)
      .maybeSingle();
    if (!old) return await err("notFound");
    const { error } = await ctx.sb
      .from("venues")
      .update(row)
      .eq("id", venueId)
      .eq("wedding_id", wid);
    if (error) return fail("saveVenue", error);
    await removeFiles(
      ctx.sb,
      old.photo_paths.filter((p) => !v.photoPaths.includes(p)),
    );
  } else {
    const { data, error } = await ctx.sb
      .from("venues")
      .insert({ ...row, wedding_id: wid })
      .select("id")
      .single();
    if (error) return fail("saveVenue", error);
    venueId = data.id;
    // start every venue with a useful site-visit checklist, in the couple's language
    const q = await contentTranslations(ctx.wedding, "places");
    await ctx.sb.from("venue_checklist_items").insert(
      VISIT_QUESTION_KEYS.map((key, i) => ({
        wedding_id: wid,
        venue_id: venueId!,
        question: q(`visitQuestions.${key}`),
        sort_order: i,
      })),
    );
  }

  if (v.status === "booked") await releaseOtherBookings(ctx.sb, wid, venueId, v.kind);
  done();
  return { ok: true, data: { id: venueId } };
}

export async function setVenueStatus(id: string, status: string): Promise<ActionResult> {
  const ctx = await editor();
  const parsed = venueSchema.shape.status.safeParse(status);
  if (!ctx || !idSchema.safeParse(id).success || !parsed.success) return noPermission();
  const { data, error } = await ctx.sb
    .from("venues")
    .update({ status: parsed.data })
    .eq("id", id)
    .eq("wedding_id", ctx.wedding.id)
    .select("kind")
    .single();
  if (error) return fail("setVenueStatus", error);
  if (parsed.data === "booked") await releaseOtherBookings(ctx.sb, ctx.wedding.id, id, data.kind);
  return done();
}

export async function deleteVenue(id: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !idSchema.safeParse(id).success) return noPermission();
  const { data, error } = await ctx.sb
    .from("venues")
    .delete()
    .eq("id", id)
    .eq("wedding_id", ctx.wedding.id)
    .select("photo_paths");
  if (error) return fail("deleteVenue", error);
  await removeFiles(
    ctx.sb,
    (data ?? []).flatMap((r) => r.photo_paths),
  );
  return done();
}

// ---------- site-visit checklist ----------

export async function saveChecklistItem(
  venueId: string,
  input: unknown,
  id?: string,
): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !idSchema.safeParse(venueId).success) return noPermission();
  const parsed = checklistItemSchema.safeParse(input);
  if (!parsed.success) return await invalid(parsed.error);
  const row = {
    question: parsed.data.question,
    answer: parsed.data.answer || null,
    done: parsed.data.done,
  };

  if (id) {
    const { error } = await ctx.sb
      .from("venue_checklist_items")
      .update(row)
      .eq("id", id)
      .eq("wedding_id", ctx.wedding.id);
    if (error) return fail("saveChecklistItem", error);
  } else {
    const { count } = await ctx.sb
      .from("venue_checklist_items")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venueId);
    const { error } = await ctx.sb
      .from("venue_checklist_items")
      .insert({ ...row, wedding_id: ctx.wedding.id, venue_id: venueId, sort_order: count ?? 0 });
    if (error) return fail("saveChecklistItem", error);
  }
  revalidatePath("/app/venues");
  return { ok: true };
}

export async function deleteChecklistItem(id: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !idSchema.safeParse(id).success) return noPermission();
  const { error } = await ctx.sb
    .from("venue_checklist_items")
    .delete()
    .eq("id", id)
    .eq("wedding_id", ctx.wedding.id);
  if (error) return fail("deleteChecklistItem", error);
  revalidatePath("/app/venues");
  return { ok: true };
}
