// Date maths for "who's staying when". Dates are plain calendar dates
// ("2027-03-05"), handled in UTC so time zones never shift them. A night is
// named by the date it starts (the night of 5 March = check in 5, out 6).

export type Stay = { from: string; to: string };
export type MaybeStay = { from: string | null; to: string | null };

const DAY = 86_400_000;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const time = (d: string) => Date.parse(`${d}T00:00:00Z`);

export function isDate(d: string | null | undefined): d is string {
  return !!d && ISO.test(d) && !Number.isNaN(time(d));
}

export function addDays(date: string, days: number): string {
  return new Date(time(date) + days * DAY).toISOString().slice(0, 10);
}

/** Nights between check-in and check-out; 0 when a date is missing or check-out isn't after check-in. */
export function nightsBetween(from: string | null | undefined, to: string | null | undefined) {
  if (!isDate(from) || !isDate(to)) return 0;
  return Math.max(0, Math.round((time(to) - time(from)) / DAY));
}

/** Every night from check-in up to (not including) check-out. */
export function nightList(from: string | null | undefined, to: string | null | undefined) {
  const n = nightsBetween(from, to);
  return Array.from({ length: n }, (_, i) => addDays(from as string, i));
}

/**
 * A guest's real stay: their own dates where set, otherwise the booked dates.
 * Null when it doesn't add up to at least one night.
 */
export function effectiveStay(own: MaybeStay, booked: MaybeStay | null): Stay | null {
  const from = own.from ?? booked?.from ?? null;
  const to = own.to ?? booked?.to ?? null;
  return isDate(from) && isDate(to) && nightsBetween(from, to) > 0 ? { from, to } : null;
}

/** Store only what differs from the booked dates (null = "same as booked"). */
export function normaliseStay(stay: MaybeStay, booked: MaybeStay | null): MaybeStay {
  return {
    from: stay.from && stay.from !== booked?.from ? stay.from : null,
    to: stay.to && stay.to !== booked?.to ? stay.to : null,
  };
}

/** How a stay differs from the booking: nights added before/after, nights skipped at the start/end. */
export function stayDiff(stay: Stay, booked: Stay | null) {
  if (!booked) return { early: 0, late: 0, skipStart: 0, skipEnd: 0, same: true };
  const early = stay.from < booked.from ? nightsBetween(stay.from, booked.from) : 0;
  const late = stay.to > booked.to ? nightsBetween(booked.to, stay.to) : 0;
  const skipStart = stay.from > booked.from ? nightsBetween(booked.from, stay.from) : 0;
  const skipEnd = stay.to < booked.to ? nightsBetween(stay.to, booked.to) : 0;
  return { early, late, skipStart, skipEnd, same: !early && !late && !skipStart && !skipEnd };
}

export function roomsNeeded(guests: number, perRoom: number) {
  return guests > 0 ? Math.ceil(guests / Math.max(1, perRoom)) : 0;
}

export type NightRow = {
  date: string;
  guests: number;
  rooms: number;
  /** night is inside the main booking */
  booked: boolean;
};

/**
 * Guests and rooms for every night from the earliest arrival to the latest
 * departure, including quiet nights with nobody.
 */
export function nightTable(
  stays: (Stay | null)[],
  perRoom: number,
  booked: Stay | null,
): NightRow[] {
  const valid = stays.filter((s): s is Stay => !!s);
  const starts = valid.map((s) => s.from);
  const ends = valid.map((s) => s.to);
  if (booked) {
    starts.push(booked.from);
    ends.push(booked.to);
  }
  if (!starts.length) return [];
  const first = starts.reduce((a, b) => (a < b ? a : b));
  const last = ends.reduce((a, b) => (a > b ? a : b));
  return nightList(first, last).map((date) => {
    const guests = valid.filter((s) => s.from <= date && date < s.to).length;
    return {
      date,
      guests,
      rooms: roomsNeeded(guests, perRoom),
      booked: !!booked && booked.from <= date && date < booked.to,
    };
  });
}

/** Room-nights needed outside the main booking. */
export function extraRoomNights(rows: NightRow[]) {
  return rows.filter((r) => !r.booked).reduce((sum, r) => sum + r.rooms, 0);
}

export type StaySummaryGuest = { id: string; name: string; stay: Stay | null };

/** Everything the hotel needs to know, from a list of guests and the booking. */
export function staySummary(guests: StaySummaryGuest[], booked: Stay | null, perRoom: number) {
  const early: { id: string; name: string; date: string; nights: number }[] = [];
  const late: { id: string; name: string; date: string; nights: number }[] = [];
  const shorter: { id: string; name: string; stay: Stay; nights: number }[] = [];
  for (const g of guests) {
    if (!g.stay || !booked) continue;
    const d = stayDiff(g.stay, booked);
    if (d.early) early.push({ id: g.id, name: g.name, date: g.stay.from, nights: d.early });
    if (d.late) late.push({ id: g.id, name: g.name, date: g.stay.to, nights: d.late });
    if (d.skipStart || d.skipEnd)
      shorter.push({ id: g.id, name: g.name, stay: g.stay, nights: d.skipStart + d.skipEnd });
  }
  const byDate = <T extends { date: string; name: string }>(a: T, b: T) =>
    a.date.localeCompare(b.date) || a.name.localeCompare(b.name);
  early.sort(byDate);
  late.sort(byDate);
  shorter.sort((a, b) => a.stay.from.localeCompare(b.stay.from) || a.name.localeCompare(b.name));
  const nights = nightTable(
    guests.map((g) => g.stay),
    perRoom,
    booked,
  );
  const count = guests.filter((g) => g.stay).length;
  return {
    guests: count,
    rooms: roomsNeeded(count, perRoom),
    early,
    late,
    shorter,
    nights,
    extraRoomNights: extraRoomNights(nights),
  };
}

/** Two stays that cover different nights (roommates arriving or leaving on different days). */
export function sameNights(a: Stay | null, b: Stay | null) {
  return a?.from === b?.from && a?.to === b?.to;
}

/** Nights in a shared room when only one of several roommates is there. */
export function aloneNights(stays: (Stay | null)[]) {
  const valid = stays.filter((s): s is Stay => !!s);
  if (valid.length < 2) return 0;
  return nightTable(valid, 1, null).filter((r) => r.guests === 1).length;
}
