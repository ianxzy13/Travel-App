"use client";

import { SUPABASE_URL } from "@/lib/supabase/env";
import { STD_TEMPLATES, type StdTemplate } from "@/lib/save-the-date/templates";

export type CardData = {
  template: StdTemplate;
  headline: string;
  subline: string | null;
  mediaPath: string | null;
  mediaType: "image" | "video" | null;
  partnerAName: string;
  partnerBName: string;
  weddingDate: string | null;
  location: string | null;
  showDate: boolean;
  showLocation: boolean;
};

function mediaUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/std-media/${path}`;
}

function formatDate(date: string) {
  try {
    return new Date(date + "T00:00:00").toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return date;
  }
}

const FONT_CLASSES: Record<StdTemplate, { heading: string; body: string }> = {
  elegant: { heading: "font-serif", body: "font-serif" },
  modern: { heading: "font-sans font-bold", body: "font-sans" },
  playful: { heading: "font-sans font-light tracking-wide", body: "font-sans" },
};

export function CardPreview({ data, className }: { data: CardData; className?: string }) {
  const t = STD_TEMPLATES[data.template];
  const fonts = FONT_CLASSES[data.template];
  const couple = `${data.partnerAName} & ${data.partnerBName}`;

  return (
    <div
      className={`relative overflow-hidden rounded-lg shadow-lg ${className ?? ""}`}
      style={{ background: t.bg, color: t.fg, border: `1px solid ${t.border}`, aspectRatio: "5/7" }}
    >
      {data.mediaPath && data.mediaType === "image" && (
        <div className="absolute inset-0">
          <img
            src={mediaUrl(data.mediaPath)}
            alt=""
            className="size-full object-cover"
          />
          <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, ${t.bg}99 0%, ${t.bg}11 30%, ${t.bg}11 50%, ${t.bg}DD 75%, ${t.bg} 100%)` }} />
        </div>
      )}
      {data.mediaPath && data.mediaType === "video" && (
        <div className="absolute inset-0">
          <video
            src={mediaUrl(data.mediaPath)}
            autoPlay
            loop
            muted
            playsInline
            className="size-full object-cover"
          />
          <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, ${t.bg}99 0%, ${t.bg}11 30%, ${t.bg}11 50%, ${t.bg}DD 75%, ${t.bg} 100%)` }} />
        </div>
      )}

      <div className="relative flex size-full flex-col items-center justify-between p-6 text-center sm:p-8">
        <div className="mt-4">
          <p
            className={`text-xs tracking-[0.3em] uppercase ${fonts.body}`}
            style={{ color: t.accent }}
          >
            {data.headline}
          </p>
        </div>

        <div className="space-y-3">
          <h2
            className={`text-3xl leading-tight sm:text-4xl ${fonts.heading}`}
            style={{ color: t.fg }}
          >
            {couple}
          </h2>
          <div className="mx-auto h-px w-16" style={{ background: t.accent }} />
          {data.subline && (
            <p className={`text-sm ${fonts.body}`} style={{ color: t.muted }}>
              {data.subline}
            </p>
          )}
        </div>

        <div className="mb-4 space-y-1">
          {data.showDate && data.weddingDate && (
            <p className={`text-sm tracking-wide ${fonts.body}`} style={{ color: t.muted }}>
              {formatDate(data.weddingDate)}
            </p>
          )}
          {data.showLocation && data.location && (
            <p className={`text-xs ${fonts.body}`} style={{ color: t.muted }}>
              {data.location}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
