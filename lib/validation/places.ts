import { z } from "zod";

const text = (max: number) =>
  z.string().trim().max(max, `Please keep this under ${max} characters`);
const money = z.number().finite().min(0, "Amounts can't be negative").max(9_999_999_999).nullable();
const date = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date")]);
const count = (max: number) => z.number().int("Whole numbers only").min(0).max(max).nullable();
const url = z.union([
  z.literal(""),
  z.url("Please enter a full web address, e.g. https://…").max(500),
]);

export const venueSchema = z.object({
  name: text(120).min(1, "Please enter a name"),
  kind: z.enum(["ceremony", "reception", "both"]),
  status: z.enum(["researching", "contacted", "visited", "shortlisted", "booked", "rejected"]),
  availability: z.enum(["unknown", "available", "tentative", "unavailable"]),
  address: text(300),
  contactName: text(120),
  phone: text(50),
  email: z.union([z.literal(""), z.email("Please enter a valid email").max(320)]),
  website: url,
  capacity: count(100000),
  price: money,
  included: text(2000),
  pros: text(2000),
  cons: text(2000),
  notes: text(4000),
  rating: z.number().int().min(1).max(5).nullable(),
  visitDate: date,
  photoPaths: z.array(z.string().max(500)).max(12, "Up to 12 photos"),
});
export type VenueValues = z.infer<typeof venueSchema>;

export const checklistItemSchema = z.object({
  question: text(200).min(1, "Please enter a question"),
  answer: text(1000),
  done: z.boolean(),
});

export const hotelSchema = z.object({
  name: text(120).min(1, "Please enter a name"),
  status: z.enum(["considering", "contacted", "block_confirmed", "rejected"]),
  address: text(300),
  distance: text(100),
  website: url,
  bookingUrl: url,
  pricePerNight: money,
  roomsHeld: count(10000),
  roomsBooked: count(10000),
  discountCode: text(100),
  cutoffDate: date,
  showOnWebsite: z.boolean(),
  forCouple: z.boolean(),
  notes: text(4000),
});
export type HotelValues = z.infer<typeof hotelSchema>;

export const hotelGuestsSchema = z
  .array(
    z.object({
      guestId: z.uuid(),
      room: text(60),
      checkIn: date,
      checkOut: date,
    }),
  )
  .max(2000)
  .refine((list) => list.every((g) => !g.checkIn || !g.checkOut || g.checkOut >= g.checkIn), {
    message: "Check-out can't be before check-in",
  });

const localDateTime = z.union([
  z.literal(""),
  z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Invalid date/time"),
]);

export const flightSchema = z
  .object({
    category: z.enum(["guest", "couple", "honeymoon"]),
    direction: z.enum(["arrival", "departure", "other"]),
    status: z.enum(["considering", "booked"]),
    airline: text(80),
    flightNumber: text(20),
    fromAirport: text(60),
    toAirport: text(60),
    departAt: localDateTime,
    arriveAt: localDateTime,
    bookingRef: text(40),
    price: money,
    baggage: text(300),
    otherTravellers: text(300),
    needsPickup: z.boolean(),
    notes: text(2000),
    travellerIds: z.array(z.uuid()).max(100),
  })
  .refine((f) => !f.departAt || !f.arriveAt || f.arriveAt >= f.departAt.slice(0, 10), {
    path: ["arriveAt"],
    message: "Arrival looks earlier than departure",
  });
export type FlightValues = z.infer<typeof flightSchema>;
