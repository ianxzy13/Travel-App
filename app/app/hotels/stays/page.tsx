import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { StayPlanner } from "@/components/hotels/stay-planner";
import { loadStays } from "@/lib/hotels/load-stays";
import { createClient } from "@/lib/supabase/server";
import { canEdit, requireWedding } from "@/lib/wedding";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("hotels"))("stays.title") };
}

export default async function HotelStays() {
  const { wedding, role } = await requireWedding();
  const sb = await createClient();
  const { hotels, guests, guestSaid } = await loadStays(sb, wedding.id);
  return (
    <StayPlanner
      hotels={hotels}
      guests={guests}
      guestSaid={guestSaid}
      weddingDate={wedding.wedding_date}
      canEdit={canEdit(role)}
    />
  );
}
