"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { checkUpload } from "@/lib/photos/upload";
import { createClient } from "@/lib/supabase/server";

const slugSchema = z
  .string()
  .min(3)
  .max(60)
  .regex(/^[a-z0-9-]+$/);

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

  return (
    data as {
      id: string;
      uploader_name: string;
      file_path: string;
      caption: string | null;
      width: number | null;
      height: number | null;
      created_at: string;
    }[]
  ).map((p) => ({
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

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "No file selected" };
  const check = checkUpload(file);
  if (!check.ok) {
    return {
      ok: false,
      error: check.reason === "tooBig" ? "Photo too large" : "Only JPEG, PNG or WebP photos",
    };
  }

  const sb = await createClient();

  const { data: pageData } = await sb.rpc("get_photo_page", { p_slug: parsedSlug.data });
  const wedding = pageData as { id: string } | null;
  if (!wedding) return { ok: false, error: "Photo sharing is not enabled" };

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `${wedding.id}/${ts}-${rand}.${ext}`;

  const { error: uploadError } = await sb.storage
    .from("photos")
    .upload(path, file, { upsert: false, contentType: file.type });
  if (uploadError) return { ok: false, error: "Upload failed. Please try again." };

  const caption =
    String(formData.get("caption") ?? "")
      .trim()
      .slice(0, 500) || null;
  const size = (key: string) => {
    const n = Number(formData.get(key));
    return Number.isInteger(n) && n > 0 && n <= 10000 ? n : null;
  };

  const { data: photoId, error: rpcError } = await sb.rpc("upload_wedding_photo", {
    p_slug: parsedSlug.data,
    p_uploader_name: parsedName.data,
    p_file_path: path,
    p_caption: caption,
    p_width: size("width"),
    p_height: size("height"),
  });

  if (rpcError) return { ok: false, error: "Failed to save photo record" };
  return { ok: true, data: { id: photoId as string } };
}
