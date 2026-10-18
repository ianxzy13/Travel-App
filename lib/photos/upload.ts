// Guest photo uploads: shared limits plus the browser-side shrink step.
//
// Phone photos are often 3–10 MB, but Vercel refuses requests over 4.5 MB.
// So the guest's browser resizes each photo to a sensible size and saves it
// as JPEG before sending it (usually 300–900 KB).

/** Longest side, in pixels, after shrinking. Plenty for screens and prints. */
export const MAX_PHOTO_SIDE = 2048;
/** Largest file the server accepts (after shrinking). */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
/** Largest original we try to shrink (bigger is almost always a video or RAW). */
export const MAX_ORIGINAL_BYTES = 40 * 1024 * 1024;
export const ALLOWED_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type PhotoCheck = { ok: true } | { ok: false; reason: "notImage" | "tooBig" | "empty" };

/** Whether a picked file is worth trying to shrink. */
export function checkOriginal(file: { type: string; size: number; name: string }): PhotoCheck {
  if (file.size === 0) return { ok: false, reason: "empty" };
  const isImage =
    file.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
  if (!isImage) return { ok: false, reason: "notImage" };
  if (file.size > MAX_ORIGINAL_BYTES) return { ok: false, reason: "tooBig" };
  return { ok: true };
}

/** What the server accepts once the browser has shrunk the photo. */
export function checkUpload(file: { type: string; size: number }): PhotoCheck {
  if (file.size === 0) return { ok: false, reason: "empty" };
  if (!(ALLOWED_UPLOAD_TYPES as readonly string[]).includes(file.type))
    return { ok: false, reason: "notImage" };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, reason: "tooBig" };
  return { ok: true };
}

/** New width and height so the longest side is at most `max`. */
export function fitWithin(width: number, height: number, max = MAX_PHOTO_SIDE) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Browser only. Turns any photo the browser can open into a JPEG no larger
 * than MAX_PHOTO_SIDE. Returns null if the browser can't read it (for example
 * an iPhone HEIC photo in Chrome on a computer).
 */
export async function shrinkPhoto(
  file: File,
): Promise<{ file: File; width: number; height: number } | null> {
  let bitmap: ImageBitmap;
  try {
    // "from-image" keeps phone photos the right way up
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return null;
  }
  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  for (const quality of [0.85, 0.7, 0.55]) {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
    if (blob && blob.size <= MAX_UPLOAD_BYTES) {
      const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
      return { file: new File([blob], name, { type: "image/jpeg" }), width, height };
    }
  }
  return null;
}
