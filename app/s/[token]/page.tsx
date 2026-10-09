import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Accent } from "@/lib/database.types";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { SaveTheDatePublic } from "@/components/save-the-date/save-the-date-public";

type StdPublic = {
  id: string;
  media_path: string | null;
  media_type: "image" | "video" | null;
  template: "elegant" | "modern" | "playful";
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

async function loadStd(token: string): Promise<StdPublic | null> {
  if (!isSupabaseConfigured || !/^[a-f0-9]{24}$/.test(token)) return null;
  const sb = await createClient();
  const { data } = await sb.rpc("get_save_the_date", { p_token: token });
  return (data as StdPublic) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const std = await loadStd(token);
  if (!std) return { title: "Save the Date", robots: { index: false } };
  const couple = `${std.partner_a_name} & ${std.partner_b_name}`;
  return {
    title: `${std.headline} — ${couple}`,
    description: std.subline ?? `${couple} are getting married!`,
    robots: { index: false },
  };
}

export default async function SaveTheDatePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const std = await loadStd(token);
  if (!std) notFound();

  return <SaveTheDatePublic std={std} />;
}
