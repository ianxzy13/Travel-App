"use client";

/* eslint-disable @next/next/no-img-element -- temporary private links and local previews */
import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const BUCKET = "wedding-files";
const MAX_BYTES = 10 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Uploads a website picture to <wedding>/website/… and returns its path plus a
 * local preview link. Pictures only become visible to guests once the site
 * is published.
 */
export async function uploadSiteImage(weddingId: string, file: File) {
  if (!IMAGE_TYPES.includes(file.type)) {
    toast.error("Please choose a JPG, PNG or WebP photo.");
    return null;
  }
  if (file.size > MAX_BYTES) {
    toast.error("That photo is larger than 10 MB. Please choose a smaller one.");
    return null;
  }
  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-60);
  const path = `${weddingId}/website/${crypto.randomUUID()}-${safeName}`;
  const { error } = await createClient()
    .storage.from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) {
    console.error(error);
    toast.error("Upload failed. Is file storage set up (see README)? Please try again.");
    return null;
  }
  return { path, url: URL.createObjectURL(file) };
}

/** One picture: shows it, and lets you upload, replace or remove it. */
export function ImageSlot({
  weddingId,
  path,
  url,
  label,
  onChange,
  aspect = "aspect-[3/2]",
  disabled,
}: {
  weddingId: string;
  path: string | null;
  url: string | null;
  label: string;
  onChange: (next: { path: string; url: string } | null) => void;
  aspect?: string;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(file: File) {
    setBusy(true);
    const r = await uploadSiteImage(weddingId, file);
    setBusy(false);
    if (r) onChange(r);
  }

  return (
    <div className="space-y-2">
      <input
        ref={input}
        type="file"
        accept={IMAGE_TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-label={label}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void pick(f);
        }}
      />
      <div className={cn("bg-muted relative overflow-hidden rounded-lg border", aspect)}>
        {path && url ? (
          <img src={url} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => input.current?.click()}
            className="text-muted-foreground hover:bg-accent focus-visible:ring-ring absolute inset-0 flex flex-col items-center justify-center gap-1 text-sm focus-visible:ring-2 focus-visible:outline-none"
          >
            {busy ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : (
              <ImagePlus className="size-5" aria-hidden />
            )}
            {busy ? "Uploading…" : label}
          </button>
        )}
      </div>
      {path && (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || busy}
            onClick={() => input.current?.click()}
          >
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <ImagePlus aria-hidden />}{" "}
            Replace
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || busy}
            onClick={() => onChange(null)}
          >
            <Trash2 aria-hidden /> Remove
          </Button>
        </div>
      )}
    </div>
  );
}
