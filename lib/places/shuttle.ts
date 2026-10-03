import { fmtDate } from "@/lib/i18n/format";

export type ShuttlePassenger = {
  name: string;
  arrivalTime: string | null;
  flightNumber: string | null;
  people: number;
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

/** One arriving flight the couple picks up. */
export type ShuttleArrival = {
  date: string;
  time: string;
  airport: string;
  name: string;
  flightNumber: string | null;
  people: number;
};

type ArrivalEntry = ShuttleArrival;

/** The flight-board fields the shuttle plan needs. */
type BoardFlightLike = {
  category: string;
  direction: string;
  needs_pickup: boolean;
  arrive_at: string | null;
  to_airport: string | null;
  flight_number: string | null;
  other_travellers: string | null;
  travellerIds: string[];
};

/**
 * Arrivals the couple switched "Shuttle" on for (needs_pickup), ready for
 * planShuttleRuns(). Guests' own requests don't count until the couple decides.
 */
export function shuttleArrivals(
  flights: BoardFlightLike[],
  nameOf: (guestId: string) => string,
): ShuttleArrival[] {
  return flights
    .filter(
      (f) =>
        f.direction === "arrival" && f.category !== "honeymoon" && f.needs_pickup && f.arrive_at,
    )
    .map((f) => {
      const names = [
        ...f.travellerIds.map(nameOf),
        ...(f.other_travellers ? [f.other_travellers] : []),
      ];
      return {
        date: f.arrive_at!.slice(0, 10),
        time: f.arrive_at!.slice(11, 16) || "12:00",
        airport: (f.to_airport ?? "").toUpperCase() || "???",
        name: names.join(", ") || "?",
        flightNumber: f.flight_number,
        people: Math.max(1, f.travellerIds.length + (f.other_travellers ? 1 : 0)),
      };
    });
}

/**
 * Groups arrivals into shuttle pickup runs.
 * Each run covers one airport within a time window (default 90 minutes).
 * Returns days sorted by date, runs sorted by earliest arrival time.
 */
export function planShuttleRuns(
  arrivals: ShuttleArrival[],
  opts: { windowMinutes?: number; locale?: string } = {},
): ShuttleDay[] {
  const windowMs = (opts.windowMinutes ?? 90) * 60_000;
  const locale = opts.locale ?? "en";

  const entries: ArrivalEntry[] = [...arrivals];

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
      name: e.name,
      arrivalTime: e.time,
      flightNumber: e.flightNumber,
      people: e.people,
    })),
    peopleCount: entries.reduce((n, e) => n + e.people, 0),
  };
}

function timeToMs(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h * 60 + m) * 60_000;
}
