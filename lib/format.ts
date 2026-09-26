import { format, parseISO } from "date-fns";

/** "12 Jun 2027", or a friendly fallback when no date is set yet. */
export function formatWeddingDate(date: string | null, pattern = "d MMM yyyy") {
  return date ? format(parseISO(date), pattern) : "Date to be decided";
}
