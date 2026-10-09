"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import type { StdTemplateEnum } from "@/lib/database.types";
import { fail, noPermission, invalid } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { canEdit, requireWedding } from "@/lib/wedding";

async function editor() {
  const { wedding, role } = await requireWedding();
  if (!canEdit(role)) return null;
  return { wedding, supabase: await createClient() };
}

function done(): ActionResult {
  revalidatePath("/app", "layout");
  return { ok: true };
}

const designSchema = z.object({
  template: z.enum(["elegant", "modern", "playful"]),
  headline: z.string().trim().min(1).max(120),
  subline: z.string().trim().max(200).optional().default(""),
  message: z.string().trim().max(2000).optional().default(""),
  showDate: z.boolean(),
  showLocation: z.boolean(),
  showCountdown: z.boolean(),
});

export async function ensureSaveTheDate(): Promise<
  ActionResult<{
    id: string;
    media_path: string | null;
    media_type: "image" | "video" | null;
    template: StdTemplateEnum;
    headline: string;
    subline: string | null;
    message: string | null;
    token: string;
    show_date: boolean;
    show_location: boolean;
    show_countdown: boolean;
    published: boolean;
  }>
> {
  const ctx = await editor();
  if (!ctx) return noPermission();

  const { data: existing } = await ctx.supabase
    .from("save_the_dates")
    .select("*")
    .eq("wedding_id", ctx.wedding.id)
    .maybeSingle();

  if (existing) return { ok: true, data: existing };

  const { data: created, error } = await ctx.supabase
    .from("save_the_dates")
    .insert({ wedding_id: ctx.wedding.id })
    .select()
    .single();

  if (error) return fail("ensureSaveTheDate", error);
  return { ok: true, data: created };
}

export async function updateDesign(input: unknown): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return noPermission();
  const parsed = designSchema.safeParse(input);
  if (!parsed.success) return await invalid(parsed.error);
  const v = parsed.data;

  const { error } = await ctx.supabase
    .from("save_the_dates")
    .update({
      template: v.template,
      headline: v.headline,
      subline: v.subline || null,
      message: v.message || null,
      show_date: v.showDate,
      show_location: v.showLocation,
      show_countdown: v.showCountdown,
    })
    .eq("wedding_id", ctx.wedding.id);

  if (error) return fail("updateDesign", error);
  return done();
}

export async function uploadMedia(formData: FormData): Promise<ActionResult<{ path: string }>> {
  const ctx = await editor();
  if (!ctx) return noPermission();

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ok: false, error: "No file selected" };
  if (file.size > 20 * 1024 * 1024) return { ok: false, error: "File too large (max 20 MB)" };

  const imageTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
  const videoTypes = ["video/mp4", "video/quicktime", "video/webm"];
  const allowed = [...imageTypes, ...videoTypes];

  if (!allowed.includes(file.type)) {
    return { ok: false, error: "Only JPEG, PNG, WebP, HEIC images or MP4, MOV, WebM videos" };
  }

  const mediaType = imageTypes.includes(file.type) ? "image" : "video";
  const ext = file.name.split(".").pop()?.toLowerCase() || (mediaType === "image" ? "jpg" : "mp4");
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `${ctx.wedding.id}/${ts}-${rand}.${ext}`;

  const { error: uploadError } = await ctx.supabase.storage
    .from("std-media")
    .upload(path, file, { upsert: false });

  if (uploadError) return { ok: false, error: "Upload failed. Please try again." };

  const { data: old } = await ctx.supabase
    .from("save_the_dates")
    .select("media_path")
    .eq("wedding_id", ctx.wedding.id)
    .maybeSingle();

  if (old?.media_path) {
    await ctx.supabase.storage.from("std-media").remove([old.media_path]);
  }

  const { error } = await ctx.supabase
    .from("save_the_dates")
    .update({ media_path: path, media_type: mediaType })
    .eq("wedding_id", ctx.wedding.id);

  if (error) return fail("uploadMedia", error);
  revalidatePath("/app", "layout");
  return { ok: true, data: { path } };
}

export async function removeMedia(): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return noPermission();

  const { data } = await ctx.supabase
    .from("save_the_dates")
    .select("media_path")
    .eq("wedding_id", ctx.wedding.id)
    .maybeSingle();

  if (data?.media_path) {
    await ctx.supabase.storage.from("std-media").remove([data.media_path]);
  }

  const { error } = await ctx.supabase
    .from("save_the_dates")
    .update({ media_path: null, media_type: null })
    .eq("wedding_id", ctx.wedding.id);

  if (error) return fail("removeMedia", error);
  return done();
}

export async function togglePublish(publish: boolean): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return noPermission();

  const { error } = await ctx.supabase
    .from("save_the_dates")
    .update({
      published: publish,
      published_at: publish ? new Date().toISOString() : null,
    })
    .eq("wedding_id", ctx.wedding.id);

  if (error) return fail("togglePublish", error);
  return done();
}
