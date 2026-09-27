import type {
  FlightCategory,
  FlightDirection,
  HotelStatus,
  VenueAvailability,
  VenueKind,
  VenueStatus,
} from "@/lib/database.types";

const muted = "bg-muted text-muted-foreground";
const sky = "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200";
const amber = "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200";
const violet = "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200";
const green = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200";
const red = "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200";

// Labels are in messages "places.*"; these are the badge colours.

export const VENUE_STATUS_CLASS: Record<VenueStatus, string> = {
  researching: muted,
  contacted: sky,
  visited: violet,
  shortlisted: amber,
  booked: green,
  rejected: `${muted} line-through`,
};

export const VENUE_KINDS: VenueKind[] = ["ceremony", "reception", "both"];

export const AVAILABILITY_CLASS: Record<VenueAvailability, string> = {
  unknown: muted,
  available: green,
  tentative: amber,
  unavailable: red,
};

export const HOTEL_STATUS_CLASS: Record<HotelStatus, string> = {
  considering: muted,
  contacted: sky,
  block_confirmed: green,
  rejected: `${muted} line-through`,
};

export const FLIGHT_CATEGORIES: FlightCategory[] = ["guest", "couple", "honeymoon"];
export const FLIGHT_DIRECTIONS: FlightDirection[] = ["arrival", "departure", "other"];

/** Questions every couple should ask on a venue visit (texts in messages "places.visitQuestions"). */
export const VISIT_QUESTION_KEYS = [
  "rain",
  "music",
  "restrictions",
  "suppliers",
  "included",
  "payment",
  "setup",
  "parking",
  "access",
  "stay",
] as const;
