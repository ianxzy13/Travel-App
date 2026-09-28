import { ImageResponse } from "next/og";
import type { HeadingFont, SiteTemplate } from "@/lib/database.types";
import { formatWeddingDate } from "@/lib/format";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { TEMPLATES } from "@/lib/website/templates";

export const alt = "Wedding website";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Google Fonts family for each heading font (the link-preview image is drawn on the server).
const GOOGLE: Record<HeadingFont, string> = {
  cormorant: "EB Garamond:wght@500",
  playfair: "Playfair Display:ital@1",
  fraunces: "Fraunces:wght@500",
  josefin: "Josefin Sans:wght@300",
  inter: "Inter:wght@800",
  "great-vibes": "Great Vibes",
};

/** Downloads just the letters we need; returns null if it fails (a default font is used). */
async function loadFont(family: string, text: string) {
  try {
    const css = await (
      await fetch(
        `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}&text=${encodeURIComponent(text)}`,
      )
    ).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    return url ? await (await fetch(url)).arrayBuffer() : null;
  } catch {
    return null;
  }
}

/** The picture shown when the website link is shared (WhatsApp, iMessage, Facebook…). */
export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  type Info = {
    partner_a_name: string;
    partner_b_name: string;
    wedding_date: string | null;
    location: string | null;
  };
  let info: Info | null = null;
  type Look = {
    template: SiteTemplate;
    accent_color: string | null;
    heading_font: HeadingFont | null;
  };
  let look: Look | null = null;
  if (isSupabaseConfigured) {
    const sb = await createClient();
    const [{ data: w }, { data: site }] = await Promise.all([
      sb.rpc("get_wedding_public", { p_slug: slug }),
      sb.rpc("get_public_site", { p_slug: slug }),
    ]);
    info = w as Info | null;
    look = (site as { settings?: Look } | null)?.settings ?? null;
  }

  const t = TEMPLATES[look?.template ?? "classic"];
  const accent = look?.accent_color ?? t.colors.accent;
  const names = info ? `${info.partner_a_name} & ${info.partner_b_name}` : "Our wedding";
  const when = info?.wedding_date ? formatWeddingDate(info.wedding_date, "d MMMM yyyy") : "";
  const where = info?.location ?? "";
  const headingFont = look?.heading_font ?? t.heading;
  const font = await loadFont(GOOGLE[headingFont], names);
  const upper = look?.template === "modern" || look?.template === "beach";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: t.colors.bg,
        color: t.colors.fg,
        border: `24px solid ${t.colors.card}`,
        padding: 60,
      }}
    >
      <div style={{ fontSize: 26, letterSpacing: 8, textTransform: "uppercase", color: accent }}>
        We&apos;re getting married
      </div>
      <div
        style={{
          marginTop: 30,
          fontSize: names.length > 26 ? 78 : 100,
          fontFamily: font ? "Heading" : undefined,
          textTransform: upper ? "uppercase" : "none",
          fontWeight: headingFont === "inter" ? 800 : 500,
          textAlign: "center",
          lineHeight: 1.05,
        }}
      >
        {names}
      </div>
      <div style={{ marginTop: 34, width: 180, height: 3, background: accent }} />
      <div style={{ marginTop: 34, fontSize: 34, color: t.colors.muted, textAlign: "center" }}>
        {[when, where].filter(Boolean).join("  ·  ")}
      </div>
    </div>,
    { ...size, fonts: font ? [{ name: "Heading", data: font, style: "normal" }] : undefined },
  );
}
