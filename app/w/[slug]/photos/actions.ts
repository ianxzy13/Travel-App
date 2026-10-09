"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";

const slugSchema = z.string().min(3).max(60).regex(/^[a-z0-9-]+$/);

export type PhotoEntry = {
  id: string;
  uploaderName: string;
  filePath: string;
  caption: string | null;
  width: number | null;
  height: number | null;
  createdAt: string;
};

export async function listPhotos(slug: string): Promise<PhotoEntry[]> {
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) return [];

  const sb = await createClient();
  const { data } = await sb.rpc("list_wedding_photos", { p_slug: parsed.data });
  if (!data || !Array.isArray(data)) return [];

  return (data as {
    id: string;
    uploader_name: string;
    file_path: string;
    caption: string | null;
    width: number | null;
    height: number | null;
    created_at: string;
  }[]).map((p) => ({
    id: p.id,
    uploaderName: p.uploader_name,
    filePath: p.file_path,
    caption: p.caption,
    width: p.width,
    height: p.height,
    createdAt: p.created_at,
  }));
}

export async function uploadPhoto(
  slug: string,
  name: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const parsedSlug = slugSchema.safeParse(slug);
  const parsedName = z.string().trim().min(1).max(100).safeParse(name);
  if (!parsedSlug.success || !parsedName.success) {
    return { ok: false, error: "Invalid input" };
  }

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ok: false, error: "No file selected" };
  if (file.size > 15 * 1024 * 1024) return { ok: false, error: "File too large (max 15 MB)" };

  const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
  if (!allowed.includes(file.type)) {
    return { ok: false, error: "Only JPEG, PNG, WebP, or HEIC images" };
  }

  const sb = await createClient();

  const { data: pageData } = await sb.rpc("get_photo_page", { p_slug: parsedSlug.data });
  const wedding = pageData as { id: string } | null;
  if (!wedding) return { ok: false, error: "Photo sharing is not enabled" };

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `${wedding.id}/${ts}-${rand}.${ext}`;

  const { error: uploadError } = await sb.storage
    .from("photos")
    .upload(path, file, { upsert: false });
  if (uploadError) return { ok: false, error: "Upload failed. Please try again." };

  const caption = (formData.get("caption") as string)?.trim() || null;

  const { data: photoId, error: rpcError } = await sb.rpc("upload_wedding_photo", {
    p_slug: parsedSlug.data,
    p_uploader_name: parsedName.data,
    p_file_path: path,
    p_caption: caption,
  });

  if (rpcError) return { ok: false, error: "Failed to save photo record" };
  return { ok: true, data: { id: photoId as string } };
}
