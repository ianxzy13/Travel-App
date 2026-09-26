import { format, parseISO } from "date-fns";

/** "12 Jun 2027", or a friendly fallback when no date is set yet. */
export function formatWeddingDate(date: string | null, pattern = "d MMM yyyy") {
  return date ? format(parseISO(date), pattern) : "Date to be decided";
}

/** Postgres returns times as "14:30:00"; show "14:30". */
export function formatTime(time: string | null) {
  return time ? time.slice(0, 5) : "";
}

/** "Sat 12 Jun 2027 · 14:00–16:00" (skips whatever isn't set). */
export function formatEventWhen(e: {
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
}) {
  const date = e.event_date
    ? format(parseISO(e.event_date), "EEE d MMM yyyy")
    : "Date to be decided";
  const start = formatTime(e.start_time);
  const end = formatTime(e.end_time);
  const time = start && end ? `${start}–${end}` : start;
  return time ? `${date} · ${time}` : date;
}
