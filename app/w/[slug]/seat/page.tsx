import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Accent } from "@/lib/database.types";
import { getTranslations } from "next-intl/server";
import { FindSeatForm } from "@/components/website/find-seat-form";
import { RsvpFrame } from "@/components/rsvp/rsvp-frame";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

type PublicWedding = {
  partner_a_name: string;
  partner_b_name: string;
  accent: Accent;
  find_seat_enabled?: boolean;
};

// Guests can't read the weddings table, so this goes through the public function.
async function loadWedding(slug: string) {
  if (!isSupabaseConfigured || !/^[a-z0-9-]{3,60}$/.test(slug)) return null;
  const sb = await createClient();
  const { data } = await sb.rpc("get_wedding_public", { p_slug: slug });
  return (data as PublicWedding | null) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTranslations("site.findSeat");
  const w = await loadWedding(slug);
  if (!w) return { title: t("title"), robots: { index: false } };
  return {
    title: `${t("title")} — ${w.partner_a_name} & ${w.partner_b_name}`,
    robots: { index: false },
  };
}

export default async function FindSeatPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const w = await loadWedding(slug);
  if (!w || !w.find_seat_enabled) notFound();

  const t = await getTranslations("site.findSeat");

  return (
    <RsvpFrame accent={w.accent} couple={`${w.partner_a_name} & ${w.partner_b_name}`}>
      <div className="bg-card mx-auto mt-10 max-w-md rounded-2xl border p-8 shadow-sm">
        <h1 className="text-center text-4xl">{t("heading")}</h1>
        <p className="text-muted-foreground mt-2 mb-6 text-center">{t("title")}</p>
        <FindSeatForm slug={slug} />
      </div>
    </RsvpFrame>
  );
}
