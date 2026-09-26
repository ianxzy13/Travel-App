import { addDays, differenceInCalendarDays, format, parseISO, subMonths } from "date-fns";

// The suggested wedding timeline and helpers for grouping to-dos (unit-tested).

export type Suggestion = {
  key: string;
  title: string;
  category: string;
  /** how long before the wedding it's due (negative days = after) */
  before: { months?: number; days?: number };
  link?: string;
  /** budget category whose booked vendor means "done" (see detectDone) */
  vendorCategory?: string;
};

export const SUGGESTIONS: Suggestion[] = [
  // 12+ months
  { key: "set-budget", title: "Set your total budget", category: "Budget", before: { months: 13 }, link: "/app/budget" },
  { key: "guest-list-draft", title: "Draft your guest list", category: "Guests", before: { months: 13 }, link: "/app/guests" },
  { key: "inspiration", title: "Collect ideas on an inspiration board", category: "Style", before: { months: 12 }, link: "/app/inspiration" },
  { key: "planner", title: "Decide whether you want a wedding planner", category: "Vendors", before: { months: 12 }, link: "/app/vendors" },
  { key: "book-venue", title: "Visit and book your venue", category: "Venue", before: { months: 12 }, link: "/app/venues" },
  { key: "photographer", title: "Book your photographer", category: "Vendors", before: { months: 11 }, link: "/app/vendors", vendorCategory: "Photography" },
  // 9–12 months
  { key: "caterer", title: "Book your caterer (if the venue doesn't do food)", category: "Vendors", before: { months: 10 }, link: "/app/vendors", vendorCategory: "Catering" },
  { key: "videographer", title: "Book a videographer", category: "Vendors", before: { months: 10 }, link: "/app/vendors", vendorCategory: "Videography" },
  { key: "music", title: "Book your band or DJ", category: "Vendors", before: { months: 9 }, link: "/app/vendors", vendorCategory: "Music / DJ" },
  { key: "officiant", title: "Book your officiant", category: "Ceremony", before: { months: 9 } },
  { key: "wedding-party", title: "Ask your wedding party", category: "People", before: { months: 9 } },
  { key: "room-blocks", title: "Reserve hotel room blocks for guests", category: "Travel", before: { months: 9 }, link: "/app/hotels" },
  { key: "attire", title: "Start shopping for wedding attire", category: "Attire", before: { months: 9 } },
  { key: "website", title: "Publish your wedding website", category: "Guests", before: { months: 9 }, link: "/app/website" },
  { key: "save-the-dates", title: "Send save-the-dates", category: "Guests", before: { months: 8 }, link: "/app/guests" },
  // 6–9 months
  { key: "florist", title: "Book your florist", category: "Vendors", before: { months: 6 }, link: "/app/vendors", vendorCategory: "Flowers" },
  { key: "registry", title: "Set up your registry", category: "Guests", before: { months: 6 }, link: "/app/website" },
  { key: "honeymoon", title: "Plan and book the honeymoon", category: "Travel", before: { months: 6 }, link: "/app/travel" },
  { key: "invitations-order", title: "Order invitations", category: "Stationery", before: { months: 6 } },
  // 3–6 months
  { key: "cake", title: "Choose and order the cake", category: "Food", before: { months: 5 } },
  { key: "rentals", title: "Book rentals (tables, chairs, linens, tent)", category: "Decor", before: { months: 5 } },
  { key: "transport", title: "Book transport for the day", category: "Vendors", before: { months: 5 }, link: "/app/vendors", vendorCategory: "Transportation" },
  { key: "hair-makeup", title: "Book hair & makeup (and a trial)", category: "Vendors", before: { months: 5 }, link: "/app/vendors", vendorCategory: "Hair & Makeup" },
  { key: "menu-tasting", title: "Go to the menu tasting", category: "Food", before: { months: 3 } },
  { key: "rings", title: "Buy your wedding rings", category: "Attire", before: { months: 3 } },
  { key: "paperwork", title: "Check the marriage licence paperwork", category: "Ceremony", before: { months: 3 } },
  // 1–3 months
  { key: "send-invitations", title: "Send invitations", category: "Guests", before: { months: 2 }, link: "/app/rsvp" },
  { key: "vows", title: "Write your vows", category: "Ceremony", before: { months: 2 } },
  { key: "ceremony-order", title: "Plan the ceremony order with your officiant", category: "Ceremony", before: { months: 2 } },
  { key: "song-list", title: "Make must-play and do-not-play song lists", category: "Music", before: { months: 2 } },
  { key: "fittings", title: "Book final dress and suit fittings", category: "Attire", before: { months: 1, days: 14 } },
  // final month
  { key: "chase-rsvps", title: "Chase guests who haven't replied", category: "Guests", before: { days: 30 }, link: "/app/rsvp" },
  { key: "seating", title: "Finish the seating chart", category: "Guests", before: { days: 21 }, link: "/app/seating" },
  { key: "final-numbers", title: "Give final numbers and meals to the caterer", category: "Food", before: { days: 14 }, link: "/app/rsvp" },
  { key: "run-sheet", title: "Write the day-of schedule and share it with vendors", category: "Day of", before: { days: 14 }, link: "/app/schedule" },
  { key: "final-payments", title: "Check final payments are planned", category: "Budget", before: { days: 14 }, link: "/app/budget" },
  { key: "place-cards", title: "Print escort and place cards", category: "Stationery", before: { days: 10 }, link: "/app/seating" },
  // week of
  { key: "confirm-vendors", title: "Confirm arrival times with every vendor", category: "Day of", before: { days: 7 }, link: "/app/schedule" },
  { key: "pack", title: "Pack for the honeymoon", category: "Travel", before: { days: 5 } },
  { key: "tips", title: "Prepare envelopes for vendor tips and final payments", category: "Budget", before: { days: 3 }, link: "/app/budget" },
  { key: "emergency-kit", title: "Pack an emergency kit (safety pins, plasters, snacks)", category: "Day of", before: { days: 2 } },
  { key: "rest", title: "Rest, drink water and enjoy it!", category: "Day of", before: { days: 1 } },
  // after
  { key: "thank-you", title: "Send thank-you notes", category: "Guests", before: { days: -21 } },
  { key: "reviews", title: "Leave reviews for your vendors", category: "Vendors", before: { days: -30 }, link: "/app/vendors" },
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
export function missingSuggestions(existingKeys: Set<string>, weddingDate: string, today: string) {
  const list = SUGGESTIONS.filter((s) => !existingKeys.has(s.key));
  const catchUp = list.filter((s) => suggestionDue(s, weddingDate, today) === today);
  const daysLeft = differenceInCalendarDays(parseISO(weddingDate), parseISO(today));
  const spread = Math.max(0, Math.min(28, Math.floor(daysLeft / 4)));
  return list.map((s, i) => {
    let due = suggestionDue(s, weddingDate, today);
    const c = catchUp.indexOf(s);
    if (c > 0 && spread > 0) due = iso(addDays(parseISO(today), Math.round((c * spread) / catchUp.length)));
    return {
      suggestion_key: s.key,
      title: s.title,
      category: s.category,
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

export const PHASES = [
  { key: "12m", label: "12+ months before" },
  { key: "9m", label: "9–12 months before" },
  { key: "6m", label: "6–9 months before" },
  { key: "3m", label: "3–6 months before" },
  { key: "1m", label: "1–3 months before" },
  { key: "month", label: "The final month" },
  { key: "week", label: "The week of the wedding" },
  { key: "after", label: "After the wedding" },
  { key: "none", label: "No due date" },
] as const;
export type PhaseKey = (typeof PHASES)[number]["key"];

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

/** Suggestion keys the data says are done, with a short reason. */
export function detectDone(p: Progress): Record<string, string> {
  const out: Record<string, string> = {};
  if (p.budgetSet) out["set-budget"] = "Your total budget is set.";
  if (p.guests > 0) out["guest-list-draft"] = `You have ${p.guests} guests on your list.`;
  if (p.pins > 0) out["inspiration"] = "You've started pinning ideas.";
  if (p.venueBooked) out["book-venue"] = "A venue is marked as booked.";
  if (p.websitePublished) out["website"] = "Your website is published.";
  if (p.roomBlockConfirmed) out["room-blocks"] = "A room block is confirmed.";
  if (p.invitesSent) out["send-invitations"] = "Invitations have been emailed.";
  if (p.scheduleItems > 0) out["run-sheet"] = "Your day-of schedule has started.";
  if (p.seatingDone) out["seating"] = "Everyone attending has a seat.";
  const booked = new Set(p.bookedVendorCategories.map((c) => c.toLowerCase()));
  for (const s of SUGGESTIONS) {
    if (s.vendorCategory && booked.has(s.vendorCategory.toLowerCase())) out[s.key] = `A ${s.vendorCategory} vendor is booked.`;
  }
  return out;
}
