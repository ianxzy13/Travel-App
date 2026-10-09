"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { canEdit, requireWedding } from "@/lib/wedding";
import { fail, noPermission } from "@/lib/errors";

const idSchema = z.uuid();

async function editor() {
  const { wedding, role } = await requireWedding();
  if (!canEdit(role)) return null;
  return { wedding, sb: await createClient() };
}

function done(): ActionResult {
  revalidatePath("/app/photos");
  revalidatePath("/app");
  return { ok: true };
}

export async function togglePhotos(enabled: boolean): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return noPermission();

  const { error } = await ctx.sb
    .from("weddings")
    .update({ photos_enabled: enabled })
    .eq("id", ctx.wedding.id);
  if (error) return fail("togglePhotos", error);
  return done();
}

export async function deletePhoto(id: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return noPermission();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid ID" };

  const { data: photo } = await ctx.sb
    .from("wedding_photos")
    .select("file_path")
    .eq("id", parsed.data)
    .eq("wedding_id", ctx.wedding.id)
    .maybeSingle();

  if (photo?.file_path) {
    await ctx.sb.storage.from("photos").remove([photo.file_path]);
  }

  const { error } = await ctx.sb
    .from("wedding_photos")
    .delete()
    .eq("id", parsed.data)
    .eq("wedding_id", ctx.wedding.id);
  if (error) return fail("deletePhoto", error);
  return done();
}
