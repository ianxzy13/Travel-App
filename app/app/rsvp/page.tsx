import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { RsvpDashboard } from "@/components/rsvp-admin/rsvp-dashboard";
import { isEmailConfigured } from "@/lib/email/resend";
import { loadRsvpDashboard } from "@/lib/rsvp/load";
import { getSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import { canEdit, coupleName, requireWedding } from "@/lib/wedding";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("rsvpAdmin"))("title") };
}

export default async function RsvpPage({
  searchParams,
}: {
  searchParams: Promise<{ household?: string }>;
}) {
  const { wedding, role } = await requireWedding();
  const { household } = await searchParams;
  const data = await loadRsvpDashboard(await createClient(), wedding);

  return (
    <RsvpDashboard
      // re-mount when switching weddings
      key={wedding.id}
      data={data}
      settings={{
        deadline: wedding.rsvp_deadline ?? "",
        contact: wedding.rsvp_contact ?? "",
        askSong: wedding.rsvp_ask_song,
        notifyEmail: wedding.rsvp_notify_email,
      }}
      siteUrl={await getSiteUrl()}
      slug={wedding.slug}
      couple={coupleName(wedding)}
      emailConfigured={isEmailConfigured}
      adminConfigured={Boolean(process.env.SUPABASE_SECRET_KEY)}
      canEdit={canEdit(role)}
      focusHouseholdId={household}
      languages={wedding.languages}
    />
  );
}
