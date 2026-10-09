"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, ImagePlus, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { listPhotos, uploadPhoto, type PhotoEntry } from "@/app/w/[slug]/photos/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SUPABASE_URL } from "@/lib/supabase/env";

function photoUrl(filePath: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/photos/${filePath}`;
}

export function GuestPhotoPage({
  slug,
  initialPhotos,
}: {
  slug: string;
  initialPhotos: PhotoEntry[];
}) {
  const t = useTranslations("site.photos");
  const [photos, setPhotos] = useState(initialPhotos);
  const [name, setName] = useState("");
  const [caption, setCaption] = useState("");
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0 || !name.trim()) return;

    const uploads = Array.from(files);
    startTransition(async () => {
      let success = 0;
      for (const file of uploads) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("caption", caption);
        const r = await uploadPhoto(slug, name.trim(), fd);
        if (r.ok) success++;
        else toast.error(r.error);
      }
      if (success > 0) {
        toast.success(t("uploaded", { count: success }));
        setCaption("");
        const updated = await listPhotos(slug);
        setPhotos(updated);
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  }

  return (
    <div className="space-y-8">
      <div className="bg-card rounded-2xl border p-6 shadow-sm">
        <div className="mb-4 text-center">
          <Camera className="text-primary mx-auto mb-2 size-10" aria-hidden />
          <h2 className="font-serif text-2xl font-medium">{t("heading")}</h2>
          <p className="text-muted-foreground mt-1 text-sm">{t("desc")}</p>
        </div>

        <div className="space-y-3">
          <Input
            placeholder={t("yourName")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
          <Textarea
            placeholder={t("captionPlaceholder")}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={2}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            multiple
            className="hidden"
            onChange={handleUpload}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={pending || !name.trim()}
            className="w-full"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <ImagePlus className="size-4" aria-hidden />
            )}
            {t("upload")}
          </Button>
        </div>
      </div>

      {photos.length > 0 && (
        <div>
          <h3 className="text-muted-foreground mb-3 text-center text-sm font-medium">
            {t("gallery", { count: photos.length })}
          </h3>
          <div className="columns-2 gap-2 space-y-2 sm:columns-3">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="bg-card break-inside-avoid overflow-hidden rounded-lg border"
              >
                <img
                  src={photoUrl(photo.filePath)}
                  alt={photo.caption || t("photoBy", { name: photo.uploaderName })}
                  loading="lazy"
                  className="w-full"
                />
                <div className="p-2">
                  {photo.caption && (
                    <p className="text-sm">{photo.caption}</p>
                  )}
                  <p className="text-muted-foreground text-xs">
                    {photo.uploaderName}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
