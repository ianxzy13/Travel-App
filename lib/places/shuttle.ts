import type { GuestTravelRow } from "@/lib/database.types";
import { fmtDate } from "@/lib/i18n/format";

export type ShuttlePassenger = {
  householdId: string;
  householdName: string;
  arrivalTime: string | null;
  flightNumber: string | null;
  needsTransfer: boolean;
};

export type ShuttleRun = {
  id: string;
  airport: string;
  windowStart: string;
  windowEnd: string;
  passengers: ShuttlePassenger[];
  peopleCount: number;
};

export type ShuttleDay = {
  date: string;
  label: string;
  runs: ShuttleRun[];
  totalPeople: number;
};

type ArrivalEntry = {
  date: string;
  time: string;
  airport: string;
  householdId: string;
  householdName: string;
  flightNumber: string | null;
};

/**
 * Groups arrivals that need transfers into shuttle pickup runs.
 * Each run covers one airport within a time window (default 90 minutes).
 * Returns days sorted by date, runs sorted by earliest arrival time.
 */
export function planShuttleRuns(
  guestTravel: (GuestTravelRow & { householdName: string })[],
  _coupleFlights?: unknown[],
  opts: { windowMinutes?: number; locale?: string } = {},
): ShuttleDay[] {
  const windowMs = (opts.windowMinutes ?? 90) * 60_000;
  const locale = opts.locale ?? "en";

  const entries: ArrivalEntry[] = [];

  for (const gt of guestTravel) {
    if (!gt.needs_transfer || !gt.arrival_date) continue;
    entries.push({
      date: gt.arrival_date,
      time: gt.arrival_time ?? "12:00",
      airport: (gt.arrival_airport ?? "").toUpperCase() || "???",
      householdId: gt.household_id,
      householdName: gt.householdName,
      flightNumber: gt.arrival_flight,
    });
  }

  if (entries.length === 0) return [];

  entries.sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    if (d !== 0) return d;
    return a.time.localeCompare(b.time);
  });

  const dayMap = new Map<string, ArrivalEntry[]>();
  for (const e of entries) {
    dayMap.set(e.date, [...(dayMap.get(e.date) ?? []), e]);
  }

  const days: ShuttleDay[] = [];

  for (const [date, dayEntries] of [...dayMap.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const byAirport = new Map<string, ArrivalEntry[]>();
    for (const e of dayEntries) {
      byAirport.set(e.airport, [...(byAirport.get(e.airport) ?? []), e]);
    }

    const runs: ShuttleRun[] = [];

    for (const [airport, airportEntries] of byAirport) {
      const sorted = [...airportEntries].sort((a, b) => a.time.localeCompare(b.time));
      let currentRun: ArrivalEntry[] = [];
      let runStart = "";

      for (const entry of sorted) {
        if (currentRun.length === 0) {
          currentRun = [entry];
          runStart = entry.time;
        } else {
          const startMs = timeToMs(runStart);
          const entryMs = timeToMs(entry.time);
          if (entryMs - startMs <= windowMs) {
            currentRun.push(entry);
          } else {
            runs.push(buildRun(airport, currentRun, runs.length));
            currentRun = [entry];
            runStart = entry.time;
          }
        }
      }
      if (currentRun.length > 0) {
        runs.push(buildRun(airport, currentRun, runs.length));
      }
    }

    runs.sort((a, b) => a.windowStart.localeCompare(b.windowStart));

    days.push({
      date,
      label: fmtDate(date, locale, "full"),
      runs,
      totalPeople: runs.reduce((n, r) => n + r.peopleCount, 0),
    });
  }

  return days;
}

function buildRun(airport: string, entries: ArrivalEntry[], idx: number): ShuttleRun {
  const times = entries.map((e) => e.time).sort();
  return {
    id: `${airport}-${idx}`,
    airport,
    windowStart: times[0],
    windowEnd: times[times.length - 1],
    passengers: entries.map((e) => ({
      householdId: e.householdId,
      householdName: e.householdName,
      arrivalTime: e.time,
      flightNumber: e.flightNumber,
      needsTransfer: true,
    })),
    peopleCount: entries.length,
  };
}

function timeToMs(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h * 60 + m) * 60_000;
}
