import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SaveTheDatePage } from "@/components/save-the-date/save-the-date-page";
import { getSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import { canEdit, requireWedding } from "@/lib/wedding";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("app.nav"))("saveTheDate") };
}

export default async function SaveTheDate() {
  const { wedding, role } = await requireWedding();
  const [sb, siteUrl] = await Promise.all([createClient(), getSiteUrl()]);

  const { data: std } = await sb
    .from("save_the_dates")
    .select("*")
    .eq("wedding_id", wedding.id)
    .maybeSingle();

  return (
    <SaveTheDatePage
      wedding={{
        partnerAName: wedding.partner_a_name,
        partnerBName: wedding.partner_b_name,
        weddingDate: wedding.wedding_date,
        location: wedding.location,
        accent: wedding.accent,
      }}
      std={std}
      siteUrl={siteUrl}
      canEdit={canEdit(role)}
    />
  );
}
