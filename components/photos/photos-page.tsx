"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Camera,
  Copy,
  Download,
  ExternalLink,
  QrCode,
  Trash2,
} from "lucide-react";
import { togglePhotos, deletePhoto } from "@/app/app/photos/actions";
import { PageHeader } from "@/components/app/page-header";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import type { WeddingPhotoRow } from "@/lib/database.types";
import { SUPABASE_URL } from "@/lib/supabase/env";

function photoUrl(filePath: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/photos/${filePath}`;
}

type Props = {
  photos: WeddingPhotoRow[];
  enabled: boolean;
  slug: string;
  shareUrl: string;
  canEdit: boolean;
};

export function PhotosPage({ photos, enabled, slug, shareUrl, canEdit: editable }: Props) {
  const t = useTranslations("app.photos");
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [pending, startTransition] = useTransition();

  function handleToggle(val: boolean) {
    setIsEnabled(val);
    startTransition(async () => {
      const r = await togglePhotos(val);
      if (r.ok) toast.success(val ? t("enabled") : t("disabled"));
      else {
        toast.error(r.error);
        setIsEnabled(!val);
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const r = await deletePhoto(id);
      if (r.ok) toast.success(t("deleted"));
      else toast.error(r.error);
    });
  }

  function copyLink() {
    navigator.clipboard.writeText(shareUrl);
    toast.success(t("linkCopied"));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          editable ? (
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/print/photos-qr">
                  <QrCode className="size-4" aria-hidden />
                  {t("printQr")}
                </Link>
              </Button>
              <Button variant="outline" size="sm" onClick={copyLink}>
                <Copy className="size-4" aria-hidden />
                {t("copyLink")}
              </Button>
            </div>
          ) : undefined
        }
      />

      {editable && (
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div>
              <p className="text-sm font-medium">{t("toggle")}</p>
              <p className="text-muted-foreground text-xs">{t("toggleDesc")}</p>
            </div>
            <Switch
              checked={isEnabled}
              onCheckedChange={handleToggle}
              disabled={pending}
            />
          </CardContent>
        </Card>
      )}

      {isEnabled && (
        <Card>
          <CardContent className="flex items-center gap-3 py-3">
            <ExternalLink className="text-muted-foreground size-4 shrink-0" aria-hidden />
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary truncate text-sm underline underline-offset-2"
            >
              {shareUrl}
            </a>
          </CardContent>
        </Card>
      )}

      {photos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Camera className="text-muted-foreground mx-auto mb-4 size-12" aria-hidden />
            <p className="text-muted-foreground mb-2 text-sm">{t("empty")}</p>
            {isEnabled && (
              <p className="text-muted-foreground text-xs">{t("emptyHint")}</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-muted-foreground text-sm">
            {t("count", { count: photos.length })}
          </p>
          <div className="columns-2 gap-3 space-y-3 sm:columns-3 lg:columns-4">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="bg-card group relative break-inside-avoid overflow-hidden rounded-lg border"
              >
                <img
                  src={photoUrl(photo.file_path)}
                  alt={photo.caption || `Photo by ${photo.uploader_name}`}
                  loading="lazy"
                  className="w-full"
                />
                <div className="p-2">
                  {photo.caption && (
                    <p className="text-sm">{photo.caption}</p>
                  )}
                  <p className="text-muted-foreground text-xs">
                    {photo.uploader_name}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {new Date(photo.created_at).toLocaleDateString()}
                  </p>
                </div>
                {editable && (
                  <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
                    <a
                      href={photoUrl(photo.file_path)}
                      download
                      className="bg-background/80 rounded p-1.5 backdrop-blur"
                    >
                      <Download className="size-4" aria-hidden />
                    </a>
                    <ConfirmDialog
                      title={t("deleteTitle")}
                      description={t("deleteDesc")}
                      onConfirm={() => handleDelete(photo.id)}
                      trigger={
                        <button className="bg-background/80 rounded p-1.5 backdrop-blur">
                          <Trash2 className="text-destructive size-4" aria-hidden />
                        </button>
                      }
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
