"use client";

import { useRef, useState } from "react";
import { ExternalLink, FileText, Loader2, Paperclip, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { discardUpload } from "@/app/app/file-actions";
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
export async function openFile(path: string, failedText = "Couldn't open the file. Please try again.") {
  // open the tab first (inside the click) so pop-up blockers allow it
  const tab = window.open("", "_blank");
  const { data, error } = await createClient().storage.from(BUCKET).createSignedUrl(path, 300);
  if (error || !data) {
    tab?.close();
    toast.error(failedText);
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
  label,
}: {
  weddingId: string;
  folder: "receipts" | "contracts" | "venues";
  value: FileRef;
  onChange: (value: FileRef) => void;
  disabled?: boolean;
  label?: string;
}) {
  const t = useTranslations("files");
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  // files uploaded in this form but not saved yet: safe to delete if replaced
  const fresh = useRef(new Set<string>());

  async function upload(file: File) {
    if (!ALLOWED.includes(file.type)) {
      toast.error(t("wrongType"));
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(t("tooBig"));
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
      toast.error(t("failed"));
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
            onClick={() => openFile(value.path, t("openFailed"))}
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
              aria-label={t("remove", { name: value.name })}
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
          {uploading ? t("uploading") : (label ?? t("attach"))}
        </Button>
      )}
      {!value && <span className="text-muted-foreground text-xs">{t("hint")}</span>}
    </div>
  );
}
