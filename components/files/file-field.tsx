"use client";

import { useRef, useState } from "react";
import { ExternalLink, FileText, Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { discardUpload } from "@/app/app/budget/actions";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { FileRef } from "@/lib/validation/budget";

const BUCKET = "wedding-files";
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "application/pdf",
];

/** Opens a private file in a new tab using a link that expires after 5 minutes. */
export async function openFile(path: string) {
  // open the tab first (inside the click) so pop-up blockers allow it
  const tab = window.open("", "_blank");
  const { data, error } = await createClient().storage.from(BUCKET).createSignedUrl(path, 300);
  if (error || !data) {
    tab?.close();
    toast.error("Couldn't open the file. Please try again.");
    return;
  }
  if (tab) tab.location.href = data.signedUrl;
  else window.location.href = data.signedUrl;
}

/**
 * Upload / view / remove one file (receipt, contract…). Files go straight
 * from the browser to Supabase Storage; storage rules check that you can
 * edit this wedding. The parent form saves the returned path.
 */
export function FileField({
  weddingId,
  folder,
  value,
  onChange,
  disabled,
  label = "Attach file",
}: {
  weddingId: string;
  folder: "receipts" | "contracts";
  value: FileRef;
  onChange: (value: FileRef) => void;
  disabled?: boolean;
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  // files uploaded in this form but not saved yet: safe to delete if replaced
  const fresh = useRef(new Set<string>());

  async function upload(file: File) {
    if (!ALLOWED.includes(file.type)) {
      toast.error("Please choose a PDF or an image (JPG, PNG, WebP, GIF, HEIC).");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("That file is larger than 10 MB. Please choose a smaller one.");
      return;
    }
    setUploading(true);
    const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
    const path = `${weddingId}/${folder}/${crypto.randomUUID()}-${safeName}`;
    const { error } = await createClient().storage.from(BUCKET).upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    setUploading(false);
    if (error) {
      console.error(error);
      toast.error("Upload failed. Is the file storage set up (see README)? Please try again.");
      return;
    }
    replace({ path, name: file.name.slice(0, 200) });
    fresh.current.add(path);
  }

  function replace(next: FileRef) {
    if (value && fresh.current.has(value.path)) {
      fresh.current.delete(value.path);
      void discardUpload(value.path);
    }
    onChange(next);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={input}
        type="file"
        accept={ALLOWED.join(",")}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void upload(f);
        }}
      />
      {value ? (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openFile(value.path)}
            className="max-w-60"
          >
            <FileText aria-hidden />
            <span className="truncate">{value.name}</span>
            <ExternalLink className="opacity-60" aria-hidden />
          </Button>
          {!disabled && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => replace(null)}
              aria-label={`Remove ${value.name}`}
            >
              <X aria-hidden />
            </Button>
          )}
        </>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || uploading}
          onClick={() => input.current?.click()}
        >
          {uploading ? <Loader2 className="animate-spin" aria-hidden /> : <Paperclip aria-hidden />}
          {uploading ? "Uploading…" : label}
        </Button>
      )}
      {!value && <span className="text-muted-foreground text-xs">PDF or image, up to 10 MB</span>}
    </div>
  );
}
