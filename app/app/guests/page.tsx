import type { Metadata } from "next";
import { GuestManager } from "@/components/guests/guest-manager";
import { loadGuestData } from "@/lib/guests/load";
import { buildGuestViews } from "@/lib/guests/model";
import { createClient } from "@/lib/supabase/server";
import { canEdit, requireWedding } from "@/lib/wedding";

export const metadata: Metadata = { title: "Guests" };

export default async function GuestsPage() {
  const { wedding, role } = await requireWedding();
  const { guests, households, invites, guestTags, events, tags, relationships } =
    await loadGuestData(await createClient(), wedding.id);

  return (
    <GuestManager
      guests={buildGuestViews({ guests, households, invites, guestTags })}
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
      canEdit={canEdit(role)}
    />
  );
}
