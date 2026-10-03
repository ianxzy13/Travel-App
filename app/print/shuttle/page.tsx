import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Car, Users } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { PrintControls } from "@/components/seating/print-controls";
import { Button } from "@/components/ui/button";
import { fmtDate } from "@/lib/i18n/format";
import { planShuttleRuns, shuttleArrivals } from "@/lib/places/shuttle";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { coupleName, requireWedding } from "@/lib/wedding";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Shuttle Plan",
    robots: { index: false },
  };
}

export default async function PrintShuttle() {
  const { wedding } = await requireWedding();
  const locale = await getLocale();
  const t = await getTranslations("travel.shuttle");
  const sb = await createClient();

  const [flights, travellers, guests] = await Promise.all([
    fetchAll((f, to) =>
      sb
        .from("flights")
        .select(
          "id, category, direction, needs_pickup, arrive_at, to_airport, flight_number, other_travellers",
        )
        .eq("wedding_id", wedding.id)
        .eq("needs_pickup", true)
        .order("arrive_at")
        .range(f, to),
    ),
    fetchAll((f, to) =>
      sb
        .from("flight_travellers")
        .select("flight_id, guest_id")
        .eq("wedding_id", wedding.id)
        .order("flight_id")
        .range(f, to),
    ),
    fetchAll((f, to) =>
      sb
        .from("guests")
        .select("id, first_name, last_name")
        .eq("wedding_id", wedding.id)
        .order("id")
        .range(f, to),
    ),
  ]);

  const guestName = new Map(guests.map((g) => [g.id, `${g.first_name} ${g.last_name}`.trim()]));
  const arrivals = shuttleArrivals(
    flights.map((fl) => ({
      ...fl,
      travellerIds: travellers.filter((tr) => tr.flight_id === fl.id).map((tr) => tr.guest_id),
    })),
    (id) => guestName.get(id) ?? "?",
  );
  const days = planShuttleRuns(arrivals, { locale });

  return (
    <div className="mx-auto max-w-3xl p-4 print:max-w-none print:p-0">
      <div className="mb-4 flex items-center gap-3 print:hidden">
        <Link href="/app/travel">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 size-4" aria-hidden /> Back
          </Button>
        </Link>
        <PrintControls />
      </div>

      <header className="mb-6 text-center">
        <h1 className="text-2xl font-bold">{coupleName(wedding)} — Shuttle Plan</h1>
        {wedding.wedding_date && (
          <p className="text-muted-foreground">{fmtDate(wedding.wedding_date, locale, "full")}</p>
        )}
      </header>

      {days.length === 0 ? (
        <p className="text-muted-foreground text-center">{t("empty")}</p>
      ) : (
        days.map((day) => (
          <section key={day.date} className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <Car className="size-5" aria-hidden />
              {day.label}
              <span className="text-muted-foreground text-sm font-normal">
                ({day.totalPeople} {day.totalPeople === 1 ? "person" : "people"})
              </span>
            </h2>
            {day.runs.map((run) => (
              <div key={run.id} className="mb-4 rounded-lg border p-4">
                <div className="mb-2 flex items-center gap-3 text-sm font-medium">
                  <span className="rounded bg-gray-100 px-2 py-0.5 dark:bg-gray-800">
                    {run.airport}
                  </span>
                  <span>
                    {run.windowStart}–{run.windowEnd}
                  </span>
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Users className="size-3.5" aria-hidden />
                    {run.peopleCount}
                  </span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-1 font-medium">Name</th>
                      <th className="py-1 font-medium">Arrival</th>
                      <th className="py-1 font-medium">Flight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {run.passengers.map((p, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-1">{p.name}</td>
                        <td className="py-1">{p.arrivalTime ?? "—"}</td>
                        <td className="py-1">{p.flightNumber ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </section>
        ))
      )}
    </div>
  );
}
