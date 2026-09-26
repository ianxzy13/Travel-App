"use client";

import { AlertTriangle, Check } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { BodyFont, HeadingFont, SiteTemplate } from "@/lib/database.types";
import type { SiteData } from "@/lib/website/content";
import { ACCENT_SWATCHES, BODY_FONTS, HEADING_FONTS, TEMPLATES } from "@/lib/website/templates";
import { cn } from "@/lib/utils";
import { ImageSlot } from "./image-slot";

type Look = SiteData["look"];
const DEFAULT = "default";

function contrast(a: string, b: string) {
  const lum = (h: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

export function DesignPanel({
  look,
  onChange,
  weddingId,
  images,
  addImage,
  disabled,
}: {
  look: Look;
  onChange: (look: Look) => void;
  weddingId: string;
  images: Record<string, string>;
  addImage: (path: string, url: string) => void;
  disabled: boolean;
}) {
  const t = TEMPLATES[look.template];
  const accent = look.accent_color ?? t.colors.accent;
  const lowContrast = contrast(accent, t.colors.bg) < 4.5;

  return (
    <div className="space-y-8">
      <fieldset>
        <legend className="mb-3 text-sm font-medium">Template</legend>
        <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Template">
          {(Object.keys(TEMPLATES) as SiteTemplate[]).map((key) => {
            const tpl = TEMPLATES[key];
            const on = look.template === key;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={disabled}
                // switching template resets colour and fonts to that template's own
                onClick={() => onChange({ ...look, template: key, accent_color: null, heading_font: null, body_font: null })}
                className={cn(
                  "focus-visible:ring-ring relative overflow-hidden rounded-xl border text-left transition focus-visible:ring-2 focus-visible:outline-none",
                  on ? "ring-primary ring-2 ring-offset-2" : "hover:border-foreground/30",
                )}
              >
                <div className="flex h-20 flex-col items-center justify-center gap-1" style={{ background: tpl.colors.bg, color: tpl.colors.fg }}>
                  <span
                    className={cn("text-2xl", key === "modern" && "font-extrabold uppercase", key === "beach" && "font-light tracking-[0.2em] uppercase", key === "garden" && "italic")}
                    style={{ fontFamily: HEADING_FONTS[tpl.heading].css }}
                  >
                    A &amp; B
                  </span>
                  <span className="h-0.5 w-10" style={{ background: tpl.colors.accent }} />
                </div>
                <div className="bg-card p-2">
                  <p className="flex items-center gap-1 text-sm font-medium">
                    {tpl.label} {on && <Check className="text-primary size-3.5" aria-hidden />}
                  </p>
                  <p className="text-muted-foreground line-clamp-2 text-xs">{tpl.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Accent colour</legend>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange({ ...look, accent_color: null })}
            aria-pressed={look.accent_color == null}
            className={cn(
              "focus-visible:ring-ring flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs focus-visible:ring-2 focus-visible:outline-none",
              look.accent_color == null && "ring-primary ring-2 ring-offset-1",
            )}
          >
            <span className="size-4 rounded-full" style={{ background: t.colors.accent }} /> Template colour
          </button>
          {ACCENT_SWATCHES.filter((c) => c !== t.colors.accent).map((c) => (
            <button
              key={c}
              type="button"
              disabled={disabled}
              onClick={() => onChange({ ...look, accent_color: c })}
              aria-pressed={look.accent_color === c}
              aria-label={`Accent colour ${c}`}
              className={cn(
                "focus-visible:ring-ring size-8 rounded-full border focus-visible:ring-2 focus-visible:outline-none",
                look.accent_color === c && "ring-primary ring-2 ring-offset-2",
              )}
              style={{ background: c }}
            />
          ))}
          <label className="text-muted-foreground flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-xs">
            <input
              type="color"
              value={accent}
              disabled={disabled}
              onChange={(e) => onChange({ ...look, accent_color: e.target.value.toLowerCase() })}
              className="size-4 cursor-pointer border-0 bg-transparent p-0"
            />
            Custom
          </label>
        </div>
        {lowContrast && (
          <p className="text-warning flex items-center gap-1.5 text-xs">
            <AlertTriangle className="size-3.5" aria-hidden /> This colour is light, so small text in it may be hard to read. A darker shade works better.
          </p>
        )}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="heading-font">Heading font</Label>
          <Select
            value={look.heading_font ?? DEFAULT}
            disabled={disabled}
            onValueChange={(v) => onChange({ ...look, heading_font: v === DEFAULT ? null : (v as HeadingFont) })}
          >
            <SelectTrigger id="heading-font" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DEFAULT}>Default: {HEADING_FONTS[t.heading].label.split(" (")[0]}</SelectItem>
              {(Object.keys(HEADING_FONTS) as HeadingFont[]).map((f) => (
                <SelectItem key={f} value={f}>
                  <span style={{ fontFamily: HEADING_FONTS[f].css }}>{HEADING_FONTS[f].label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="body-font">Text font</Label>
          <Select
            value={look.body_font ?? DEFAULT}
            disabled={disabled}
            onValueChange={(v) => onChange({ ...look, body_font: v === DEFAULT ? null : (v as BodyFont) })}
          >
            <SelectTrigger id="body-font" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DEFAULT}>Default: {BODY_FONTS[t.body].label.split(" (")[0]}</SelectItem>
              {(Object.keys(BODY_FONTS) as BodyFont[]).map((f) => (
                <SelectItem key={f} value={f}>
                  <span style={{ fontFamily: BODY_FONTS[f].css }}>{BODY_FONTS[f].label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Hero photo</p>
        <p className="text-muted-foreground text-xs">The big photo at the top. Landscape photos work best (at least 1600 px wide).</p>
        <ImageSlot
          weddingId={weddingId}
          path={look.hero_path}
          url={look.hero_path ? images[look.hero_path] : null}
          label="Upload a photo"
          disabled={disabled}
          onChange={(img) => {
            if (img) addImage(img.path, img.url);
            onChange({ ...look, hero_path: img?.path ?? null });
          }}
        />
      </div>
    </div>
  );
}
