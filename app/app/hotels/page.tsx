import type { Metadata } from "next";
import { HotelsPage } from "@/components/hotels/hotels-page";
import { loadPickerGuests } from "@/lib/guests/picker";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { canEdit, requireWedding } from "@/lib/wedding";

export const metadata: Metadata = { title: "Hotels" };

export default async function Hotels() {
  const { wedding, role } = await requireWedding();
  const sb = await createClient();
  const [hotels, stays, guests] = await Promise.all([
    fetchAll((f, t) => sb.from("hotels").select("*").eq("wedding_id", wedding.id).order("created_at").range(f, t)),
    fetchAll((f, t) =>
      sb
        .from("hotel_guest_assignments")
        .select("hotel_id, guest_id, room, check_in, check_out")
        .eq("wedding_id", wedding.id)
        .order("id")
        .range(f, t),
    ),
    loadPickerGuests(sb, wedding.id),
  ]);

  return (
    <HotelsPage
      hotels={hotels.map((h) => ({ ...h, price_per_night: h.price_per_night == null ? null : Number(h.price_per_night) }))}
      stays={stays}
      guests={guests}
      currency={wedding.currency}
      canEdit={canEdit(role)}
      today={new Date().toISOString().slice(0, 10)}
    />
  );
}
