import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { RsvpDashboard } from "@/components/rsvp-admin/rsvp-dashboard";
import { isEmailConfigured } from "@/lib/email/resend";
import { isSmsConfigured } from "@/lib/sms/twilio";
import { loadRsvpDashboard } from "@/lib/rsvp/load";
import { signPaths } from "@/lib/inspiration/load";
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
  const sb = await createClient();
  const data = await loadRsvpDashboard(sb, wedding);
  const cover = wedding.rsvp_cover_path ?? null;
  const coverUrl = cover ? ((await signPaths(sb, [cover])).get(cover) ?? null) : null;

  return (
    <RsvpDashboard
      // re-mount when switching weddings
      key={wedding.id}
      data={data}
      settings={{
        deadline: wedding.rsvp_deadline ?? "",
        contact: wedding.rsvp_contact ?? "",
        askSong: wedding.rsvp_ask_song,
        askTravel: wedding.rsvp_ask_travel,
        notifyEmail: wedding.rsvp_notify_email,
        findSeatEnabled: wedding.find_seat_enabled,
      }}
      rsvpPage={{
        weddingId: wedding.id,
        values: {
          coverPath: cover ?? "",
          welcome: wedding.rsvp_welcome ?? "",
          thanks: wedding.rsvp_thanks ?? "",
          sorry: wedding.rsvp_sorry ?? "",
        },
        coverUrl,
        translations: wedding.translations ?? {},
      }}
      siteUrl={await getSiteUrl()}
      slug={wedding.slug}
      couple={coupleName(wedding)}
      emailConfigured={isEmailConfigured}
      smsConfigured={isSmsConfigured}
      adminConfigured={Boolean(process.env.SUPABASE_SECRET_KEY)}
      canEdit={canEdit(role)}
      focusHouseholdId={household}
      languages={wedding.languages}
    />
  );
}
