import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Car, Users } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { PrintControls } from "@/components/seating/print-controls";
import { Button } from "@/components/ui/button";
import { fmtDate } from "@/lib/i18n/format";
import { planShuttleRuns } from "@/lib/places/shuttle";
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

  const [guestTravel, households] = await Promise.all([
    fetchAll((f, to) =>
      sb
        .from("guest_travel")
        .select("*")
        .eq("wedding_id", wedding.id)
        .order("arrival_date")
        .range(f, to),
    ),
    fetchAll((f, to) =>
      sb
        .from("households")
        .select("id, name")
        .eq("wedding_id", wedding.id)
        .order("name")
        .range(f, to),
    ),
  ]);

  const hhName = new Map(households.map((h) => [h.id, h.name]));
  const enriched = guestTravel.map((gt) => ({
    ...gt,
    householdName: hhName.get(gt.household_id) ?? "?",
  }));
  const days = planShuttleRuns(enriched, [], { locale });

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
                        <td className="py-1">{p.householdName}</td>
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
