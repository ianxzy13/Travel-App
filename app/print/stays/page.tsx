import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CalendarClock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { StaySummaryView } from "@/components/hotels/stay-summary";
import { PrintControls } from "@/components/seating/print-controls";
import { Button } from "@/components/ui/button";
import { staySummary } from "@/lib/hotels/nights";
import { loadStays } from "@/lib/hotels/load-stays";
import { bookedStay, guestStays, guestsForHotel, mainHotelId } from "@/lib/hotels/stays";
import { createClient } from "@/lib/supabase/server";
import { requireWedding } from "@/lib/wedding";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("hotels"))("stays.title"), robots: { index: false } };
}

export default async function PrintStaysPage({
  searchParams,
}: {
  searchParams: Promise<{ hotel?: string; notReplied?: string; noRoom?: string }>;
}) {
  const { wedding } = await requireWedding();
  const sb = await createClient();
  const t = await getTranslations("hotels");
  const q = await searchParams;
  const { hotels, guests } = await loadStays(sb, wedding.id);
  const hotel =
    hotels.find((h) => h.id === q.hotel) ?? hotels.find((h) => h.id === mainHotelId(hotels));
  const booked = bookedStay(hotel ?? null);
  const perRoom = hotel?.people_per_room ?? 4;
  const list = hotel
    ? guestsForHotel(guests, hotel.id, {
        notReplied: q.notReplied === "1",
        noRoom: q.noRoom === "1",
      })
    : [];
  const summary = staySummary(guestStays(list, booked), booked, perRoom);

  return (
    <div className="min-h-screen">
      <div className="flex items-center gap-3 p-4 print:hidden">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/app/hotels/stays">
            <ArrowLeft className="mr-1 size-4" />
            {t("export.back")}
          </Link>
        </Button>
        <div className="ml-auto">
          <PrintControls />
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-6 p-8">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <CalendarClock className="size-6" aria-hidden />
            {hotel?.name ?? t("stays.title")}
          </h1>
          <p className="text-muted-foreground text-sm">
            {wedding.partner_a_name} & {wedding.partner_b_name}
          </p>
        </div>
        {booked ? (
          <StaySummaryView
            summary={summary}
            booked={booked}
            perRoom={perRoom}
            weddingDate={wedding.wedding_date}
          />
        ) : (
          <p>{t("stays.summary.needBooking")}</p>
        )}
      </div>
    </div>
  );
}
