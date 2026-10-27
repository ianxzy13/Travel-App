"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { playlistCategorySchema, playlistSongSchema } from "@/lib/validation/playlist";
import { canEdit, requireWedding } from "@/lib/wedding";
import { fail, invalid, noPermission } from "@/lib/errors";

const id = z.uuid();

async function editor() {
  const { wedding, role } = await requireWedding();
  if (!canEdit(role)) return null;
  return { wedding, sb: await createClient() };
}

function done(): ActionResult {
  revalidatePath("/app/playlist");
  return { ok: true };
}

// ── Songs ──

export async function saveSong(songId: string | null, input: unknown): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || (songId && !id.safeParse(songId).success)) return noPermission();
  const parsed = playlistSongSchema.safeParse(input);
  if (!parsed.success) return await invalid(parsed.error);
  const v = parsed.data;
  const row = { title: v.title, artist: v.artist, category_id: v.categoryId, priority: v.priority };
  if (songId) {
    const { error } = await ctx.sb
      .from("playlist_songs")
      .update(row)
      .eq("id", songId)
      .eq("wedding_id", ctx.wedding.id);
    if (error) return fail("saveSong", error);
  } else {
    const { error } = await ctx.sb
      .from("playlist_songs")
      .insert({ ...row, wedding_id: ctx.wedding.id });
    if (error) return fail("saveSong", error);
  }
  return done();
}

export async function deleteSong(songId: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !id.safeParse(songId).success) return noPermission();
  const { error } = await ctx.sb
    .from("playlist_songs")
    .delete()
    .eq("id", songId)
    .eq("wedding_id", ctx.wedding.id);
  if (error) return fail("deleteSong", error);
  return done();
}

// ── Categories ──

export async function saveCategory(
  categoryId: string | null,
  input: unknown,
): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || (categoryId && !id.safeParse(categoryId).success)) return noPermission();
  const parsed = playlistCategorySchema.safeParse(input);
  if (!parsed.success) return await invalid(parsed.error);
  if (categoryId) {
    const { error } = await ctx.sb
      .from("playlist_categories")
      .update({ name: parsed.data.name })
      .eq("id", categoryId)
      .eq("wedding_id", ctx.wedding.id);
    if (error) return fail("saveCategory", error);
    return done();
  }
  const { data: last } = await ctx.sb
    .from("playlist_categories")
    .select("sort_order")
    .eq("wedding_id", ctx.wedding.id)
    .order("sort_order", { ascending: false })
    .limit(1);
  const { error } = await ctx.sb.from("playlist_categories").insert({
    wedding_id: ctx.wedding.id,
    name: parsed.data.name,
    sort_order: (last?.[0]?.sort_order ?? -1) + 1,
  });
  if (error) return fail("saveCategory", error);
  return done();
}

/** Deletes a category and every song in it. */
export async function deleteCategory(categoryId: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !id.safeParse(categoryId).success) return noPermission();
  const { error } = await ctx.sb
    .from("playlist_categories")
    .delete()
    .eq("id", categoryId)
    .eq("wedding_id", ctx.wedding.id);
  if (error) return fail("deleteCategory", error);
  return done();
}
