import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { nameLabels } from "@/lib/guests/labels";
import { GuestManager } from "@/components/guests/guest-manager";
import { loadGuestData } from "@/lib/guests/load";
import { isEmailConfigured } from "@/lib/email/resend";
import { buildGuestViews } from "@/lib/guests/model";
import { createClient } from "@/lib/supabase/server";
import { canEdit, requireWedding } from "@/lib/wedding";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("guests"))("title") };
}

export default async function GuestsPage() {
  const { wedding, role } = await requireWedding();
  const { guests, households, invites, guestTags, events, tags, relationships, responses } =
    await loadGuestData(await createClient(), wedding.id);

  return (
    <GuestManager
      guests={buildGuestViews({
        guests,
        households,
        invites,
        guestTags,
        responses,
        labels: await nameLabels(),
      })}
      households={households.map((h) => ({
        id: h.id,
        name: h.name,
        address: {
          line1: h.address_line1 ?? "",
          line2: h.address_line2 ?? "",
          city: h.city ?? "",
          region: h.region ?? "",
          postalCode: h.postal_code ?? "",
          country: h.country ?? "",
        },
        language: h.preferred_language ?? "",
      }))}
      events={events}
      tags={tags}
      relationships={relationships.map((r) => ({
        id: r.id,
        guestA: r.guest_a,
        guestB: r.guest_b,
        type: r.type,
        note: r.note,
      }))}
      names={{ a: wedding.partner_a_name, b: wedding.partner_b_name }}
      coupleLanguage={wedding.languages?.[0] ?? "en"}
      canEdit={canEdit(role)}
      emailConfigured={isEmailConfigured}
    />
  );
}
