"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { discardUpload } from "@/app/app/file-actions";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const BUCKET = "wedding-files";
const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic"];

/** Temporary (1 hour) links to show private photos. */
export function useSignedUrls(paths: string[]) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const key = paths.join("|");
  useEffect(() => {
    const missing = paths.filter((p) => !urls[p]);
    if (!missing.length) return;
    let cancelled = false;
    createClient()
      .storage.from(BUCKET)
      .createSignedUrls(missing, 3600)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const fresh: Record<string, string> = {};
        for (const d of data) if (d.path && d.signedUrl) fresh[d.path] = d.signedUrl;
        setUrls((u) => ({ ...u, ...fresh }));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return urls;
}

/** Several photos (upload, preview, remove). Stores storage paths. */
export function PhotosField({
  weddingId,
  folder,
  value,
  onChange,
  max = 12,
  disabled,
}: {
  weddingId: string;
  folder: "venues";
  value: string[];
  onChange: (paths: string[]) => void;
  max?: number;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const fresh = useRef(new Set<string>());
  const urls = useSignedUrls(value);

  async function upload(files: File[]) {
    const room = max - value.length;
    const chosen = files.slice(0, room);
    if (files.length > room) toast.warning(`Only ${room} more photo(s) fit.`);
    const ok = chosen.filter((f) => {
      if (!TYPES.includes(f.type))
        toast.error(`${f.name}: please choose a JPG, PNG, WebP, GIF or HEIC image.`);
      else if (f.size > MAX_BYTES) toast.error(`${f.name} is larger than 10 MB.`);
      else return true;
      return false;
    });
    if (!ok.length) return;
    setUploading(ok.length);
    const sb = createClient();
    const added: string[] = [];
    for (const f of ok) {
      const path = `${weddingId}/${folder}/${crypto.randomUUID()}-${f.name.replace(/[^\w.\-]+/g, "_").slice(-60)}`;
      const { error } = await sb.storage.from(BUCKET).upload(path, f, { contentType: f.type });
      if (error) toast.error(`Couldn't upload ${f.name}. Is the file storage set up (see README)?`);
      else {
        added.push(path);
        fresh.current.add(path);
      }
    }
    setUploading(0);
    if (added.length) onChange([...value, ...added]);
  }

  function remove(path: string) {
    if (fresh.current.has(path)) {
      fresh.current.delete(path);
      void discardUpload(path);
    }
    onChange(value.filter((p) => p !== path));
  }

  return (
    <div className="space-y-2">
      <input
        ref={input}
        type="file"
        multiple
        accept={TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          void upload(files);
        }}
      />
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {value.map((p, i) => (
          <li key={p} className="bg-muted relative aspect-square overflow-hidden rounded-lg">
            {urls[p] ? (
              <Image
                src={urls[p]}
                alt={`Photo ${i + 1}`}
                fill
                sizes="150px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="flex size-full items-center justify-center">
                <Loader2 className="text-muted-foreground size-4 animate-spin" aria-hidden />
              </div>
            )}
            {!disabled && (
              <button
                type="button"
                onClick={() => remove(p)}
                aria-label={`Remove photo ${i + 1}`}
                className="focus-visible:ring-ring absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white focus-visible:ring-2 focus-visible:outline-none"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            )}
          </li>
        ))}
        {!disabled && value.length < max && (
          <li>
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={uploading > 0}
              className={cn(
                "hover:bg-accent focus-visible:ring-ring flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-xs focus-visible:ring-2 focus-visible:outline-none",
              )}
            >
              {uploading ? (
                <Loader2 className="size-5 animate-spin" aria-hidden />
              ) : (
                <ImagePlus className="size-5" aria-hidden />
              )}
              {uploading ? `Uploading ${uploading}…` : "Add photos"}
            </button>
          </li>
        )}
      </ul>
      <p className="text-muted-foreground text-xs">
        Up to {max} photos, 10 MB each. Only people planning your wedding can see them.
      </p>
    </div>
  );
}
