"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import type { Accent } from "@/lib/database.types";
import { STD_TEMPLATES, type StdTemplate } from "@/lib/save-the-date/templates";
import { SUPABASE_URL } from "@/lib/supabase/env";

type StdPublic = {
  media_path: string | null;
  media_type: "image" | "video" | null;
  template: StdTemplate;
  headline: string;
  subline: string | null;
  message: string | null;
  show_date: boolean;
  show_location: boolean;
  show_countdown: boolean;
  partner_a_name: string;
  partner_b_name: string;
  wedding_date: string | null;
  location: string | null;
  accent: Accent;
};

function mediaUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/std-media/${path}`;
}

function formatDate(date: string) {
  try {
    return new Date(date + "T00:00:00").toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return date;
  }
}

function daysUntil(date: string) {
  const target = new Date(date + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / 86_400_000);
}

function googleCalUrl(couple: string, date: string, location: string | null) {
  const d = date.replace(/-/g, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${couple}'s Wedding`,
    dates: `${d}/${d}`,
    ...(location ? { location } : {}),
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

const FONT_CLASSES: Record<StdTemplate, { heading: string; body: string }> = {
  elegant: { heading: "font-serif", body: "font-serif" },
  modern: { heading: "font-sans font-bold", body: "font-sans" },
  playful: { heading: "font-sans font-light tracking-wide", body: "font-sans" },
};

export function SaveTheDatePublic({ std }: { std: StdPublic }) {
  const t = STD_TEMPLATES[std.template];
  const fonts = FONT_CLASSES[std.template];
  const couple = `${std.partner_a_name} & ${std.partner_b_name}`;
  const days = std.wedding_date ? daysUntil(std.wedding_date) : null;

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="min-h-dvh" style={{ background: t.bg, color: t.fg }}>
      {/* Hero */}
      <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-16 text-center">
        {std.media_path && std.media_type === "image" && (
          <div className="absolute inset-0">
            <img
              src={mediaUrl(std.media_path)}
              alt=""
              className="size-full object-cover"
            />
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(to bottom, ${t.bg}BB 0%, ${t.bg}44 35%, ${t.bg}44 55%, ${t.bg}CC 80%, ${t.bg} 100%)`,
              }}
            />
          </div>
        )}
        {std.media_path && std.media_type === "video" && (
          <div className="absolute inset-0">
            <video
              src={mediaUrl(std.media_path)}
              autoPlay
              loop
              muted
              playsInline
              className="size-full object-cover"
            />
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(to bottom, ${t.bg}BB 0%, ${t.bg}44 35%, ${t.bg}44 55%, ${t.bg}CC 80%, ${t.bg} 100%)`,
              }}
            />
          </div>
        )}

        <div className="relative z-10 max-w-lg space-y-8">
          <p
            className={`text-sm tracking-[0.4em] uppercase ${fonts.body}`}
            style={{ color: t.accent }}
          >
            {std.headline}
          </p>

          <h1
            className={`text-5xl leading-tight sm:text-7xl ${fonts.heading}`}
          >
            {couple}
          </h1>

          <div className="mx-auto h-px w-20" style={{ background: t.accent }} />

          {std.subline && (
            <p className={`text-lg ${fonts.body}`} style={{ color: t.muted }}>
              {std.subline}
            </p>
          )}

          {std.show_date && std.wedding_date && (
            <p
              className={`text-lg tracking-wide ${fonts.body}`}
              style={{ color: t.fg }}
            >
              {formatDate(std.wedding_date)}
            </p>
          )}

          {std.show_location && std.location && (
            <p className={`text-sm ${fonts.body}`} style={{ color: t.muted }}>
              {std.location}
            </p>
          )}

          {std.show_countdown && days !== null && days > 0 && mounted && (
            <p
              className={`text-4xl font-light ${fonts.heading}`}
              style={{ color: t.accent }}
            >
              {days}{" "}
              <span className="text-lg">
                {days === 1 ? "day to go" : "days to go"}
              </span>
            </p>
          )}

          {std.message && (
            <div
              className="mx-auto max-w-sm rounded-lg p-6"
              style={{ background: `${t.card}CC`, border: `1px solid ${t.border}` }}
            >
              <p className={`text-sm leading-relaxed whitespace-pre-line ${fonts.body}`} style={{ color: t.fg }}>
                {std.message}
              </p>
            </div>
          )}

          {std.wedding_date && (
            <a
              href={googleCalUrl(couple, std.wedding_date, std.location)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium transition hover:opacity-80"
              style={{ background: t.accent, color: t.bg }}
            >
              <CalendarPlus className="size-4" />
              Add to calendar
            </a>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="pb-8 text-center text-xs" style={{ color: t.muted }}>
        <Link href="/" className="hover:underline" style={{ color: t.muted }}>
          Made with Vow
        </Link>
      </footer>
    </div>
  );
}
