import { format, parseISO } from "date-fns";

// Flight times are LOCAL airport times stored without a time zone
// ("2027-06-10T14:30:00"). parseISO reads them as wall-clock time and format
// prints the same wall-clock time, so no time-zone shifting ever happens.

export type BoardFlight = {
  id: string;
  time: string | null; // local "YYYY-MM-DDTHH:mm:ss"
  flightNumber: string | null;
  airline: string | null;
  airport: string | null; // where they come from (arrivals) or go to (departures)
  travellers: string[];
  needsPickup: boolean;
  status: "considering" | "booked";
};

export type BoardDay = { date: string | null; label: string; flights: BoardFlight[]; people: number };

/** Groups flights by local day, sorted by time; flights without a time go last. */
export function groupByDay(flights: BoardFlight[]): BoardDay[] {
  const days = new Map<string, BoardFlight[]>();
  for (const f of flights) {
    const key = f.time ? f.time.slice(0, 10) : "";
    days.set(key, [...(days.get(key) ?? []), f]);
  }
  return [...days.entries()]
    .sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)))
    .map(([date, list]) => ({
      date: date || null,
      label: date ? format(parseISO(date), "EEEE d MMMM") : "Time not set",
      flights: [...list].sort((a, b) => (a.time ?? "").localeCompare(b.time ?? "")),
      people: list.reduce((n, f) => n + Math.max(1, f.travellers.length), 0),
    }));
}

/** "14:30" from a local timestamp. */
export const timeOf = (t: string | null) => (t ? t.slice(11, 16) : "");

/** Value for <input type="datetime-local"> ("YYYY-MM-DDTHH:mm"). */
export const toInputValue = (t: string | null) => (t ? t.slice(0, 16) : "");

/** Accepts only 3-letter airport codes (for search links). */
export const iata = (code: string | null | undefined) => {
  const c = (code ?? "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(c) ? c : null;
};

/**
 * Deep links to flight search sites (no API needed).
 * Dates are "YYYY-MM-DD"; `to` is required, the rest optional.
 */
export function flightSearchLinks(opts: { from?: string | null; to: string; depart?: string | null; ret?: string | null }) {
  const from = iata(opts.from);
  const to = iata(opts.to) ?? opts.to.trim();
  const phrase = [
    "Flights",
    from ? `from ${from}` : "",
    `to ${to}`,
    opts.depart ? `on ${opts.depart}` : "",
    opts.ret ? `returning ${opts.ret}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const google = `https://www.google.com/travel/flights?q=${encodeURIComponent(phrase)}`;

  // Skyscanner needs airport codes: /transport/flights/lis/lhr/270610/270615/
  const yymmdd = (d?: string | null) => (d ? d.slice(2).replace(/-/g, "") : "");
  const skyTo = iata(opts.to);
  const skyscanner =
    skyTo && opts.depart
      ? `https://www.skyscanner.net/transport/flights/${(from ?? "anywhere").toLowerCase()}/${skyTo.toLowerCase()}/${yymmdd(opts.depart)}/${opts.ret ? `${yymmdd(opts.ret)}/` : ""}`
      : null;
  return { google, skyscanner };
}

/** Google Maps search, e.g. "wedding venues near Sintra". */
export const mapsSearch = (query: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

export type RoomBlockState = { level: "none" | "ok" | "soon" | "passed"; daysLeft: number | null; free: number | null };

/**
 * Room-block reminder: "soon" within 30 days of the cut-off while rooms are
 * still free, "passed" after it. `today` is "YYYY-MM-DD".
 */
export function roomBlockState(
  h: { cutoff_date: string | null; rooms_held: number | null; rooms_booked: number | null },
  today: string,
): RoomBlockState {
  const free = h.rooms_held == null ? null : Math.max(0, h.rooms_held - (h.rooms_booked ?? 0));
  if (!h.cutoff_date) return { level: "none", daysLeft: null, free };
  const days = Math.round((Date.parse(`${h.cutoff_date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  if (days < 0) return { level: "passed", daysLeft: days, free };
  if (days <= 30 && (free == null || free > 0)) return { level: "soon", daysLeft: days, free };
  return { level: "ok", daysLeft: days, free };
}
