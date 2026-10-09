import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { GuestPhotoPage } from "@/components/photos/guest-photo-page";
import { RsvpFrame } from "@/components/rsvp/rsvp-frame";
import type { Accent } from "@/lib/database.types";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { listPhotos } from "./actions";

async function loadWeddingPublic(slug: string) {
  if (!isSupabaseConfigured || !/^[a-z0-9-]{3,60}$/.test(slug)) return null;
  const sb = await createClient();
  const { data } = await sb.rpc("get_photo_page", { p_slug: slug });
  if (!data) return null;
  return data as { partner_a_name: string; partner_b_name: string; accent: Accent };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTranslations("site.photos");
  const w = await loadWeddingPublic(slug);
  if (!w) return { title: t("title"), robots: { index: false } };
  return {
    title: `${t("title")} — ${w.partner_a_name} & ${w.partner_b_name}`,
    robots: { index: false },
  };
}

export default async function GuestPhotos({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const w = await loadWeddingPublic(slug);
  if (!w) notFound();

  const photos = await listPhotos(slug);

  return (
    <RsvpFrame accent={w.accent} couple={`${w.partner_a_name} & ${w.partner_b_name}`}>
      <GuestPhotoPage slug={slug} initialPhotos={photos} />
    </RsvpFrame>
  );
}
