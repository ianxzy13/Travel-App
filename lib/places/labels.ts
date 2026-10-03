import type {
  FlightCategory,
  FlightDirection,
  HotelStatus,
  VenueAvailability,
  VenueKind,
  VenueStatus,
} from "@/lib/database.types";

const muted = "bg-muted text-muted-foreground";
const sky = "bg-tint-mist text-tint-mist-fg";
const amber = "bg-tint-sand text-tint-sand-fg";
const violet = "bg-tint-mauve text-tint-mauve-fg";
const green = "bg-tint-sage text-tint-sage-fg";
const red = "bg-tint-clay text-tint-clay-fg";

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
  rate_requested: amber,
  rate_received: violet,
  rate_signed: green,
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
