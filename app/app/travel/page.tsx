import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { TravelPage } from "@/components/travel/travel-page";
import { loadPickerGuests } from "@/lib/guests/picker";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { canEdit, requireWedding } from "@/lib/wedding";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("app.nav"))("travel") };
}

export default async function Travel() {
  const { wedding, role } = await requireWedding();
  const sb = await createClient();
  const [flights, travellers, guests] = await Promise.all([
    fetchAll((f, t) =>
      sb.from("flights").select("*").eq("wedding_id", wedding.id).order("created_at").range(f, t),
    ),
    fetchAll((f, t) =>
      sb
        .from("flight_travellers")
        .select("flight_id, guest_id")
        .eq("wedding_id", wedding.id)
        .order("flight_id")
        .range(f, t),
    ),
    loadPickerGuests(sb, wedding.id),
  ]);

  return (
    <TravelPage
      flights={flights.map((f) => ({
        ...f,
        price: f.price == null ? null : Number(f.price),
        travellerIds: travellers.filter((t) => t.flight_id === f.id).map((t) => t.guest_id),
      }))}
      guests={guests}
      destinationAirport={wedding.destination_airport}
      weddingDate={wedding.wedding_date}
      currency={wedding.currency}
      canEdit={canEdit(role)}
    />
  );
}
