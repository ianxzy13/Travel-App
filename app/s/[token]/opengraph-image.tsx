import { ImageResponse } from "next/og";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { STD_TEMPLATES } from "@/lib/save-the-date/templates";

export const alt = "Save the Date";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type StdData = {
  template: "elegant" | "modern" | "playful";
  headline: string;
  subline: string | null;
  partner_a_name: string;
  partner_b_name: string;
  wedding_date: string | null;
  location: string | null;
  show_date: boolean;
  show_location: boolean;
};

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

export default async function OgImage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let std: StdData | null = null;

  if (isSupabaseConfigured && /^[a-f0-9]{24}$/.test(token)) {
    const sb = await createClient();
    const { data } = await sb.rpc("get_save_the_date", { p_token: token });
    std = data as StdData | null;
  }

  const t = STD_TEMPLATES[std?.template ?? "elegant"];
  const couple = std ? `${std.partner_a_name} & ${std.partner_b_name}` : "Save the Date";
  const dateText = std?.show_date && std?.wedding_date ? formatDate(std.wedding_date) : "";
  const locText = std?.show_location && std?.location ? std.location : "";
  const details = [dateText, locText].filter(Boolean).join("  ·  ");

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: t.bg,
        color: t.fg,
        border: `20px solid ${t.card}`,
        padding: 60,
      }}
    >
      <div
        style={{
          fontSize: 24,
          letterSpacing: 8,
          textTransform: "uppercase",
          color: t.accent,
        }}
      >
        {std?.headline ?? "Save the Date"}
      </div>
      <div
        style={{
          marginTop: 30,
          fontSize: couple.length > 26 ? 72 : 90,
          fontWeight: 500,
          textAlign: "center",
          lineHeight: 1.1,
        }}
      >
        {couple}
      </div>
      <div
        style={{
          marginTop: 30,
          width: 160,
          height: 3,
          background: t.accent,
        }}
      />
      {std?.subline && (
        <div style={{ marginTop: 24, fontSize: 28, color: t.muted }}>
          {std.subline}
        </div>
      )}
      {details && (
        <div
          style={{
            marginTop: 24,
            fontSize: 28,
            color: t.muted,
            textAlign: "center",
          }}
        >
          {details}
        </div>
      )}
    </div>,
    size,
  );
}
