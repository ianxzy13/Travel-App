import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { RecipientsPage } from "@/components/save-the-date/recipients-page";
import { getSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import { canEdit, requireWedding } from "@/lib/wedding";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("app.saveTheDate"))("recipientsTitle") };
}

export default async function StdRecipients() {
  const { wedding, role } = await requireWedding();
  if (!canEdit(role)) redirect("/app/save-the-date");

  const [sb, siteUrl] = await Promise.all([createClient(), getSiteUrl()]);
  const { data: std } = await sb
    .from("save_the_dates")
    .select("id, published, token")
    .eq("wedding_id", wedding.id)
    .maybeSingle();

  if (!std) redirect("/app/save-the-date");

  return (
    <RecipientsPage
      stdId={std.id}
      published={std.published}
      siteUrl={siteUrl}
      couple={`${wedding.partner_a_name} & ${wedding.partner_b_name}`}
    />
  );
}
