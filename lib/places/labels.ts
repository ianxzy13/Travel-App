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

export const VENUE_STATUS: Record<VenueStatus, { label: string; className: string }> = {
  researching: { label: "Researching", className: muted },
  contacted: { label: "Contacted", className: sky },
  visited: { label: "Visited", className: violet },
  shortlisted: { label: "Shortlisted", className: amber },
  booked: { label: "Booked", className: green },
  rejected: { label: "Not chosen", className: `${muted} line-through` },
};

export const VENUE_KIND: Record<VenueKind, string> = {
  ceremony: "Ceremony",
  reception: "Reception",
  both: "Ceremony & reception",
};

export const AVAILABILITY: Record<VenueAvailability, { label: string; className: string }> = {
  unknown: { label: "Availability unknown", className: muted },
  available: { label: "Available on our date", className: green },
  tentative: { label: "Tentatively held", className: amber },
  unavailable: { label: "Not available", className: red },
};

export const HOTEL_STATUS: Record<HotelStatus, { label: string; className: string }> = {
  considering: { label: "Considering", className: muted },
  contacted: { label: "Contacted", className: sky },
  block_confirmed: { label: "Room block confirmed", className: green },
  rejected: { label: "Not chosen", className: `${muted} line-through` },
};

export const FLIGHT_CATEGORY: Record<FlightCategory, string> = {
  guest: "Guests",
  couple: "Us",
  honeymoon: "Honeymoon",
};

export const FLIGHT_DIRECTION: Record<FlightDirection, string> = {
  arrival: "Arriving for the wedding",
  departure: "Leaving after the wedding",
  other: "Other",
};

/** Questions every couple should ask on a venue visit (editable per venue). */
export const DEFAULT_VISIT_QUESTIONS = [
  "Is there a rain plan / indoor backup?",
  "What time must the music stop?",
  "Are there noise or decoration restrictions (candles, confetti)?",
  "Can we bring our own caterer, drinks or DJ?",
  "What's included in the price (tables, chairs, linen, staff)?",
  "Deposit, payment schedule and cancellation terms?",
  "Setup and clean-up times?",
  "Parking and transport for guests?",
  "Step-free access and accessible toilets?",
  "Is there accommodation on site or nearby?",
];
