// Time helpers for the day-of schedule (unit-tested). Times are "HH:MM" or "HH:MM:SS".

/** "15:30" → 930 minutes after midnight. */
export function toMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** 930 → "15:30" (wraps past midnight). */
export function fromMinutes(total: number) {
  const m = ((Math.round(total) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function endTime(start: string, durationMin: number | null) {
  return durationMin ? fromMinutes(toMinutes(start) + durationMin) : null;
}

export type TimedItem = { id: string; start_time: string; duration_min: number | null };

/** Sorted by start time (then shortest first). */
export function sortByTime<T extends TimedItem>(items: T[]) {
  return [...items].sort(
    (a, b) => toMinutes(a.start_time) - toMinutes(b.start_time) || (a.duration_min ?? 0) - (b.duration_min ?? 0),
  );
}

/**
 * Items that start before an earlier item has finished. That's often fine
 * (photos while guests have drinks), so the page only shows a gentle hint.
 */
export function overlaps<T extends TimedItem>(items: T[]) {
  const sorted = sortByTime(items);
  const out = new Map<string, string>();
  for (let i = 1; i < sorted.length; i++) {
    for (let j = 0; j < i; j++) {
      const a = sorted[j];
      if (!a.duration_min) continue;
      if (toMinutes(sorted[i].start_time) < toMinutes(a.start_time) + a.duration_min) {
        out.set(sorted[i].id, a.id);
        break;
      }
    }
  }
  return out;
}

/** New start times when an item and everything after it moves by `delta` minutes. */
export function shiftFrom<T extends TimedItem>(items: T[], fromId: string, delta: number) {
  const sorted = sortByTime(items);
  const start = sorted.findIndex((i) => i.id === fromId);
  if (start < 0) return [];
  return sorted.slice(start).map((i) => ({ id: i.id, start_time: fromMinutes(toMinutes(i.start_time) + delta) }));
}

/** A typical wedding day, relative to the ceremony start (minutes). */
export const DAY_TEMPLATE: { offset: number; duration: number; title: string; owner?: string; location?: "ceremony" | "reception" }[] = [
  { offset: -300, duration: 180, title: "Hair & makeup", owner: "Hair & makeup artist" },
  { offset: -180, duration: 120, title: "Photographer arrives: getting-ready photos", owner: "Photographer" },
  { offset: -90, duration: 30, title: "Get dressed", owner: "Wedding party" },
  { offset: -60, duration: 30, title: "First look & couple photos", owner: "Photographer" },
  { offset: -30, duration: 30, title: "Guests arrive", location: "ceremony" },
  { offset: 0, duration: 45, title: "Ceremony", owner: "Officiant", location: "ceremony" },
  { offset: 45, duration: 75, title: "Drinks reception & family photos", owner: "Photographer", location: "reception" },
  { offset: 120, duration: 15, title: "Guests take their seats", location: "reception" },
  { offset: 135, duration: 10, title: "Grand entrance", owner: "DJ / band", location: "reception" },
  { offset: 145, duration: 90, title: "Dinner", owner: "Caterer", location: "reception" },
  { offset: 235, duration: 30, title: "Speeches", location: "reception" },
  { offset: 265, duration: 15, title: "Cake cutting", location: "reception" },
  { offset: 280, duration: 10, title: "First dance", owner: "DJ / band", location: "reception" },
  { offset: 290, duration: 180, title: "Party!", owner: "DJ / band", location: "reception" },
  { offset: 470, duration: 15, title: "Send-off", location: "reception" },
];
