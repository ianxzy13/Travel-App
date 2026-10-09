"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Check,
  Copy,
  ExternalLink,
  ImagePlus,
  Trash2,
} from "lucide-react";
import {
  ensureSaveTheDate,
  updateDesign,
  uploadMedia,
  removeMedia,
  togglePublish,
} from "@/app/app/save-the-date/actions";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Accent, SaveTheDateRow } from "@/lib/database.types";
import { STD_TEMPLATES, type StdTemplate } from "@/lib/save-the-date/templates";
import { CardPreview } from "./card-preview";

type Wedding = {
  partnerAName: string;
  partnerBName: string;
  weddingDate: string | null;
  location: string | null;
  accent: Accent;
};

type Props = {
  wedding: Wedding;
  std: SaveTheDateRow | null;
  siteUrl: string;
  canEdit: boolean;
};

async function resizeImage(file: File, maxDim: number): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (img.width <= maxDim && img.height <= maxDim) {
        resolve(file);
        return;
      }
      const scale = maxDim / Math.max(img.width, img.height);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => resolve(blob ?? file), "image/jpeg", 0.85);
    };
    img.src = url;
  });
}

export function SaveTheDatePage({ wedding, std: initial, siteUrl, canEdit: editable }: Props) {
  const t = useTranslations("app.saveTheDate");
  const [pending, start] = useTransition();
  const [std, setStd] = useState(initial);
  const [template, setTemplate] = useState<StdTemplate>(initial?.template ?? "elegant");
  const [headline, setHeadline] = useState(initial?.headline ?? "Save the Date");
  const [subline, setSubline] = useState(initial?.subline ?? "");
  const [message, setMessage] = useState(initial?.message ?? "");
  const [showDate, setShowDate] = useState(initial?.show_date ?? true);
  const [showLocation, setShowLocation] = useState(initial?.show_location ?? true);
  const [showCountdown, setShowCountdown] = useState(initial?.show_countdown ?? true);
  const [mediaPath, setMediaPath] = useState(initial?.media_path ?? null);
  const [mediaType, setMediaType] = useState(initial?.media_type ?? null);
  const [published, setPublished] = useState(initial?.published ?? false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  const shareUrl = std ? `${siteUrl}/s/${std.token}` : "";

  const init = useCallback(async () => {
    if (std) return std;
    const r = await ensureSaveTheDate();
    if (!r.ok) {
      toast.error(r.error);
      return null;
    }
    setStd(r.data as SaveTheDateRow);
    return r.data;
  }, [std]);

  function handleSave() {
    start(async () => {
      await init();
      const r = await updateDesign({
        template,
        headline,
        subline,
        message,
        showDate,
        showLocation,
        showCountdown,
      });
      if (r.ok) toast.success(t("saved"));
      else toast.error(r.error);
    });
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await init();
      let blob: Blob = file;
      if (file.type.startsWith("image/") && !file.type.includes("heic")) {
        blob = await resizeImage(file, 2000);
      }
      const fd = new FormData();
      fd.set("file", blob, file.name);
      const r = await uploadMedia(fd);
      if (r.ok) {
        setMediaPath(r.data.path);
        setMediaType(file.type.startsWith("video/") ? "video" : "image");
        toast.success(t("mediaUploaded"));
      } else {
        toast.error(r.error);
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handleRemoveMedia() {
    start(async () => {
      const r = await removeMedia();
      if (r.ok) {
        setMediaPath(null);
        setMediaType(null);
        toast.success(t("mediaRemoved"));
      } else toast.error(r.error);
    });
  }

  function handlePublish(val: boolean) {
    setPublished(val);
    start(async () => {
      await init();
      const r = await togglePublish(val);
      if (r.ok) toast.success(val ? t("published") : t("unpublished"));
      else {
        toast.error(r.error);
        setPublished(!val);
      }
    });
  }

  function handleCopy() {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success(t("linkCopied"));
    setTimeout(() => setCopied(false), 2000);
  }

  const cardData = {
    template,
    headline,
    subline: subline || null,
    mediaPath,
    mediaType,
    partnerAName: wedding.partnerAName,
    partnerBName: wedding.partnerBName,
    weddingDate: wedding.weddingDate,
    location: wedding.location,
    showDate,
    showLocation,
  };

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          editable && std ? (
            <div className="flex items-center gap-3">
              <Label htmlFor="publish-toggle" className="text-sm">
                {t("publish")}
              </Label>
              <Switch
                id="publish-toggle"
                checked={published}
                onCheckedChange={handlePublish}
                disabled={pending}
              />
            </div>
          ) : undefined
        }
      />

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Left: editor */}
        <div className="space-y-6">
          {/* Media upload */}
          <Card>
            <CardContent className="space-y-4 pt-6">
              <Label>{t("media")}</Label>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  disabled={!editable || uploading}
                >
                  <ImagePlus className="mr-2 size-4" />
                  {uploading ? t("uploading") : mediaPath ? t("changeMedia") : t("addMedia")}
                </Button>
                {mediaPath && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveMedia}
                    disabled={pending}
                  >
                    <Trash2 className="mr-2 size-4" />
                    {t("removeMedia")}
                  </Button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/webm"
                onChange={handleUpload}
                className="hidden"
              />
            </CardContent>
          </Card>

          {/* Template picker */}
          <Card>
            <CardContent className="space-y-4 pt-6">
              <Label>{t("template")}</Label>
              <div className="grid grid-cols-3 gap-3">
                {(Object.keys(STD_TEMPLATES) as StdTemplate[]).map((key) => {
                  const tmpl = STD_TEMPLATES[key];
                  const active = key === template;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => editable && setTemplate(key)}
                      className={`rounded-lg border-2 p-3 text-center text-sm transition ${
                        active
                          ? "border-primary ring-primary/20 ring-2"
                          : "border-border hover:border-primary/40"
                      }`}
                      disabled={!editable}
                    >
                      <div
                        className="mx-auto mb-2 size-8 rounded-full"
                        style={{ background: tmpl.accent }}
                      />
                      {tmpl.name}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Text fields */}
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div>
                <Label htmlFor="headline">{t("headline")}</Label>
                <Input
                  id="headline"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  maxLength={120}
                  disabled={!editable}
                />
              </div>
              <div>
                <Label htmlFor="subline">{t("subline")}</Label>
                <Input
                  id="subline"
                  value={subline}
                  onChange={(e) => setSubline(e.target.value)}
                  maxLength={200}
                  placeholder={t("sublinePlaceholder")}
                  disabled={!editable}
                />
              </div>
              <div>
                <Label htmlFor="message">{t("message")}</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={2000}
                  placeholder={t("messagePlaceholder")}
                  rows={3}
                  disabled={!editable}
                />
              </div>
            </CardContent>
          </Card>

          {/* Display toggles */}
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-center justify-between">
                <Label htmlFor="show-date">{t("showDate")}</Label>
                <Switch
                  id="show-date"
                  checked={showDate}
                  onCheckedChange={setShowDate}
                  disabled={!editable}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="show-location">{t("showLocation")}</Label>
                <Switch
                  id="show-location"
                  checked={showLocation}
                  onCheckedChange={setShowLocation}
                  disabled={!editable}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="show-countdown">{t("showCountdown")}</Label>
                <Switch
                  id="show-countdown"
                  checked={showCountdown}
                  onCheckedChange={setShowCountdown}
                  disabled={!editable}
                />
              </div>
            </CardContent>
          </Card>

          {/* Save */}
          {editable && (
            <Button onClick={handleSave} disabled={pending} className="w-full">
              {t("save")}
            </Button>
          )}

          {/* Share link */}
          {std && (
            <Card>
              <CardContent className="space-y-3 pt-6">
                <Label>{t("shareLink")}</Label>
                <div className="flex gap-2">
                  <Input value={shareUrl} readOnly className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={handleCopy}>
                    {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  </Button>
                  {published && (
                    <Button variant="outline" size="icon" asChild>
                      <a href={shareUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="size-4" />
                      </a>
                    </Button>
                  )}
                </div>
                {!published && (
                  <p className="text-muted-foreground text-xs">{t("unpublishedHint")}</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: preview */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <p className="text-muted-foreground mb-3 text-sm font-medium">{t("preview")}</p>
          <CardPreview data={cardData} className="mx-auto max-w-sm" />
        </div>
      </div>
    </>
  );
}
