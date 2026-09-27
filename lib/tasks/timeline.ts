import { addDays, differenceInCalendarDays, format, parseISO, subMonths } from "date-fns";
import { EN } from "@/i18n/messages";
import { SUGGESTED_CATEGORIES, type SuggestedKey } from "@/lib/budget/suggested";

// The suggested wedding timeline and helpers for grouping to-dos (unit-tested).
// Titles and categories are in messages "tasks.suggestions" / "tasks.categories".

export type SuggestionKey = keyof typeof EN.tasks.suggestions;
export type TaskCategory = keyof typeof EN.tasks.categories;

export type Suggestion = {
  key: SuggestionKey;
  category: TaskCategory;
  /** how long before the wedding it's due (negative days = after) */
  before: { months?: number; days?: number };
  link?: string;
  /** suggested budget category whose booked vendor means "done" (see detectDone) */
  vendorCategory?: SuggestedKey;
};

export const SUGGESTIONS: Suggestion[] = [
  // 12+ months
  {
    key: "set-budget",
    category: "Budget",
    before: { months: 13 },
    link: "/app/budget",
  },
  {
    key: "guest-list-draft",
    category: "Guests",
    before: { months: 13 },
    link: "/app/guests",
  },
  {
    key: "inspiration",
    category: "Style",
    before: { months: 12 },
    link: "/app/inspiration",
  },
  {
    key: "planner",
    category: "Vendors",
    before: { months: 12 },
    link: "/app/vendors",
  },
  {
    key: "book-venue",
    category: "Venue",
    before: { months: 12 },
    link: "/app/venues",
  },
  {
    key: "photographer",
    category: "Vendors",
    before: { months: 11 },
    link: "/app/vendors",
    vendorCategory: "photography",
  },
  // 9–12 months
  {
    key: "caterer",
    category: "Vendors",
    before: { months: 10 },
    link: "/app/vendors",
    vendorCategory: "catering",
  },
  {
    key: "videographer",
    category: "Vendors",
    before: { months: 10 },
    link: "/app/vendors",
    vendorCategory: "videography",
  },
  {
    key: "music",
    category: "Vendors",
    before: { months: 9 },
    link: "/app/vendors",
    vendorCategory: "music",
  },
  { key: "officiant", category: "Ceremony", before: { months: 9 } },
  {
    key: "wedding-party",
    category: "People",
    before: { months: 9 },
  },
  {
    key: "room-blocks",
    category: "Travel",
    before: { months: 9 },
    link: "/app/hotels",
  },
  {
    key: "attire",
    category: "Attire",
    before: { months: 9 },
  },
  {
    key: "website",
    category: "Guests",
    before: { months: 9 },
    link: "/app/website",
  },
  {
    key: "save-the-dates",
    category: "Guests",
    before: { months: 8 },
    link: "/app/guests",
  },
  // 6–9 months
  {
    key: "florist",
    category: "Vendors",
    before: { months: 6 },
    link: "/app/vendors",
    vendorCategory: "flowers",
  },
  {
    key: "registry",
    category: "Guests",
    before: { months: 6 },
    link: "/app/website",
  },
  {
    key: "honeymoon",
    category: "Travel",
    before: { months: 6 },
    link: "/app/travel",
  },
  {
    key: "invitations-order",
    category: "Stationery",
    before: { months: 6 },
  },
  // 3–6 months
  { key: "cake", category: "Food", before: { months: 5 } },
  {
    key: "rentals",
    category: "Decor",
    before: { months: 5 },
  },
  {
    key: "transport",
    category: "Vendors",
    before: { months: 5 },
    link: "/app/vendors",
    vendorCategory: "transport",
  },
  {
    key: "hair-makeup",
    category: "Vendors",
    before: { months: 5 },
    link: "/app/vendors",
    vendorCategory: "beauty",
  },
  { key: "menu-tasting", category: "Food", before: { months: 3 } },
  { key: "rings", category: "Attire", before: { months: 3 } },
  {
    key: "paperwork",
    category: "Ceremony",
    before: { months: 3 },
  },
  // 1–3 months
  {
    key: "send-invitations",
    category: "Guests",
    before: { months: 2 },
    link: "/app/rsvp",
  },
  { key: "vows", category: "Ceremony", before: { months: 2 } },
  {
    key: "ceremony-order",
    category: "Ceremony",
    before: { months: 2 },
  },
  {
    key: "song-list",
    category: "Music",
    before: { months: 2 },
  },
  {
    key: "fittings",
    category: "Attire",
    before: { months: 1, days: 14 },
  },
  // final month
  {
    key: "chase-rsvps",
    category: "Guests",
    before: { days: 30 },
    link: "/app/rsvp",
  },
  {
    key: "seating",
    category: "Guests",
    before: { days: 21 },
    link: "/app/seating",
  },
  {
    key: "final-numbers",
    category: "Food",
    before: { days: 14 },
    link: "/app/rsvp",
  },
  {
    key: "run-sheet",
    category: "Day of",
    before: { days: 14 },
    link: "/app/schedule",
  },
  {
    key: "final-payments",
    category: "Budget",
    before: { days: 14 },
    link: "/app/budget",
  },
  {
    key: "place-cards",
    category: "Stationery",
    before: { days: 10 },
    link: "/app/seating",
  },
  // week of
  {
    key: "confirm-vendors",
    category: "Day of",
    before: { days: 7 },
    link: "/app/schedule",
  },
  { key: "pack", category: "Travel", before: { days: 5 } },
  {
    key: "tips",
    category: "Budget",
    before: { days: 3 },
    link: "/app/budget",
  },
  {
    key: "emergency-kit",
    category: "Day of",
    before: { days: 2 },
  },
  {
    key: "rest",
    category: "Day of",
    before: { days: 1 },
  },
  // after
  { key: "thank-you", category: "Guests", before: { days: -21 } },
  {
    key: "reviews",
    category: "Vendors",
    before: { days: -30 },
    link: "/app/vendors",
  },
];

const iso = (d: Date) => format(d, "yyyy-MM-dd");

/** Due date for a suggestion; things that should already have happened are due today. */
export function suggestionDue(s: Suggestion, weddingDate: string, today: string) {
  let due = parseISO(weddingDate);
  if (s.before.months) due = subMonths(due, s.before.months);
  if (s.before.days) due = addDays(due, -s.before.days);
  const t = parseISO(today);
  return iso(due < t ? t : due);
}

/**
 * The suggestions that aren't on the list yet, with due dates and a sort value.
 * If you start late, the "catch-up" tasks (due today) are spread over the next
 * few weeks in timeline order instead of all landing on today.
 */
export function missingSuggestions(
  existingKeys: Set<string>,
  weddingDate: string,
  today: string,
  /** texts in the couple's language (English by default) */
  words: { title: (key: SuggestionKey) => string; category: (c: TaskCategory) => string } = {
    title: (k) => EN.tasks.suggestions[k],
    category: (c) => EN.tasks.categories[c],
  },
) {
  const list = SUGGESTIONS.filter((s) => !existingKeys.has(s.key));
  const catchUp = list.filter((s) => suggestionDue(s, weddingDate, today) === today);
  const daysLeft = differenceInCalendarDays(parseISO(weddingDate), parseISO(today));
  const spread = Math.max(0, Math.min(28, Math.floor(daysLeft / 4)));
  return list.map((s, i) => {
    let due = suggestionDue(s, weddingDate, today);
    const c = catchUp.indexOf(s);
    if (c > 0 && spread > 0)
      due = iso(addDays(parseISO(today), Math.round((c * spread) / catchUp.length)));
    return {
      suggestion_key: s.key,
      title: words.title(s.key),
      category: words.category(s.category),
      link: s.link ?? null,
      due_date: due,
      // days since 1970 keeps things roughly in date order; the index breaks ties
      sort_order: differenceInCalendarDays(parseISO(due), new Date(1970, 0, 1)) + i / 1000,
    };
  });
}

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

/** Parts of the timeline, in order (names in messages "tasks.phases"). */
export const PHASES = ["12m", "9m", "6m", "3m", "1m", "month", "week", "after", "none"] as const;
export type PhaseKey = (typeof PHASES)[number];

/** Which part of the timeline a due date falls in. */
export function phaseOf(due: string | null, weddingDate: string | null): PhaseKey {
  if (!due) return "none";
  if (!weddingDate) return "1m";
  const days = differenceInCalendarDays(parseISO(weddingDate), parseISO(due));
  if (days < 0) return "after";
  if (days <= 7) return "week";
  if (days <= 31) return "month";
  const months = days / 30.44;
  if (months < 3) return "1m";
  if (months < 6) return "3m";
  if (months < 9) return "6m";
  if (months < 12) return "9m";
  return "12m";
}

export type DueState = "overdue" | "today" | "soon" | "later" | null;

/** Overdue / due today / due within 7 days / later. */
export function dueState(due: string | null, today: string, done = false): DueState {
  if (!due || done) return null;
  const d = differenceInCalendarDays(parseISO(due), parseISO(today));
  if (d < 0) return "overdue";
  if (d === 0) return "today";
  if (d <= 7) return "soon";
  return "later";
}

// ---------------------------------------------------------------------------
// "Looks done" – what the rest of the app already knows
// ---------------------------------------------------------------------------

export type Progress = {
  budgetSet: boolean;
  guests: number;
  pins: number;
  venueBooked: boolean;
  websitePublished: boolean;
  roomBlockConfirmed: boolean;
  invitesSent: boolean;
  scheduleItems: number;
  /** budget category names that have a booked vendor */
  bookedVendorCategories: string[];
  seatingDone: boolean;
};

/** Why a to-do looks done (messages "tasks.reasons"); vendor reasons name the category. */
export type DoneReason =
  | { reason: Exclude<keyof typeof EN.tasks.reasons, "vendor">; count?: number }
  | { reason: "vendor"; category: string };

/**
 * Suggestion keys the data says are done, with a reason. Booked vendors are
 * matched by budget category name, in English or in the couple's language
 * (`categoryNames`: suggested category key → its name there).
 */
export function detectDone(
  p: Progress,
  categoryNames: Partial<Record<SuggestedKey, string>> = {},
): Record<string, DoneReason> {
  const out: Record<string, DoneReason> = {};
  if (p.budgetSet) out["set-budget"] = { reason: "set-budget" };
  if (p.guests > 0) out["guest-list-draft"] = { reason: "guest-list-draft", count: p.guests };
  if (p.pins > 0) out["inspiration"] = { reason: "inspiration" };
  if (p.venueBooked) out["book-venue"] = { reason: "book-venue" };
  if (p.websitePublished) out["website"] = { reason: "website" };
  if (p.roomBlockConfirmed) out["room-blocks"] = { reason: "room-blocks" };
  if (p.invitesSent) out["send-invitations"] = { reason: "send-invitations" };
  if (p.scheduleItems > 0) out["run-sheet"] = { reason: "run-sheet" };
  if (p.seatingDone) out["seating"] = { reason: "seating" };
  const booked = new Set(p.bookedVendorCategories.map((c) => c.toLowerCase()));
  for (const s of SUGGESTIONS) {
    if (!s.vendorCategory) continue;
    const names = [
      SUGGESTED_CATEGORIES.find((c) => c.key === s.vendorCategory)!.name,
      categoryNames[s.vendorCategory],
    ].filter((n): n is string => !!n);
    const hit = names.find((n) => booked.has(n.toLowerCase()));
    if (hit) out[s.key] = { reason: "vendor", category: hit };
  }
  return out;
}
