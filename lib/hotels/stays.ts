// "Who's staying when": shared shapes and filters (used on the server and in the browser).
import { effectiveStay, type Stay } from "./nights";
import type { RsvpStatus } from "./room-sharing";

export type StayHotel = {
  id: string;
  name: string;
  booked_from: string | null;
  booked_to: string | null;
  people_per_room: number | null;
};

export type StayGuest = {
  id: string;
  name: string;
  householdId: string;
  householdName: string;
  rsvp: RsvpStatus;
  /** "no" / "elsewhere" = doesn't need one of our rooms */
  wantsRoom: "yes" | "no" | "elsewhere" | null;
  stayFrom: string | null;
  stayTo: string | null;
  /** the hotel they're placed in (room or hotel guest list), if any */
  hotelId: string | null;
};

/** What the guest told us on the RSVP page, per household. */
export type GuestSaidDates = { arrival: string | null; departure: string | null };

export type StayFilters = { notReplied: boolean; noRoom: boolean };

/** Guests counted for a hotel: coming (and maybe not replied yet), needing a room, in this hotel or none. */
export function guestsForHotel(guests: StayGuest[], hotelId: string, f: StayFilters) {
  return guests.filter(
    (g) =>
      (g.hotelId === null || g.hotelId === hotelId) &&
      (g.rsvp === "attending" || (f.notReplied && g.rsvp === "not_replied")) &&
      (f.noRoom || (g.wantsRoom !== "no" && g.wantsRoom !== "elsewhere")),
  );
}

/** The hotel to show first: the first one with booked dates, else the first one. */
export function mainHotelId(hotels: StayHotel[]) {
  return (hotels.find((h) => h.booked_from && h.booked_to) ?? hotels[0])?.id ?? null;
}

/** The hotel's booked dates as a stay, or null when not set (or not valid). */
export function bookedStay(hotel: Pick<StayHotel, "booked_from" | "booked_to"> | null) {
  return hotel ? effectiveStay({ from: hotel.booked_from, to: hotel.booked_to }, null) : null;
}

/** Each guest's real stay at this hotel (their own dates, else the booking). */
export function guestStays(guests: StayGuest[], booked: Stay | null) {
  return guests.map((g) => ({
    id: g.id,
    name: g.name,
    stay: effectiveStay({ from: g.stayFrom, to: g.stayTo }, booked),
  }));
}
