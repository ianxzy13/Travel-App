import { v } from "@/lib/i18n/validation";
import { z } from "zod";

/** Shape of the answers sent to submit_rsvp() (the database re-checks everything). */
export const rsvpPayloadSchema = z.object({
  responses: z
    .array(
      z.object({
        guest_id: z.uuid(),
        event_id: z.uuid(),
        status: z.enum(["attending", "declined"]),
        meal_option_id: z.uuid().nullable(),
      }),
    )
    .max(500),
  guests: z
    .array(
      z.object({
        id: z.uuid(),
        dietary: z.string().max(500, v("tooLong", 500)),
        dietary_consent: z.boolean().optional(),
        first_name: z.string().max(80).optional(),
        last_name: z.string().max(80).optional(),
      }),
    )
    .max(100),
  song_request: z.string().max(200, v("tooLong", 200)),
  message: z.string().max(2000, v("tooLong", 2000)),
});

export type RsvpPayload = z.infer<typeof rsvpPayloadSchema>;

export const rsvpSettingsSchema = z.object({
  deadline: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, v("date"))]),
  contact: z.string().trim().max(300, v("tooLong", 300)),
  askSong: z.boolean(),
  askTravel: z.boolean(),
  notifyEmail: z.boolean(),
  findSeatEnabled: z.boolean(),
});

export type RsvpSettingsValues = z.infer<typeof rsvpSettingsSchema>;

export const mealOptionSchema = z.object({
  name: z.string().trim().min(1, v("name")).max(80),
  description: z.string().trim().max(300),
});

const optDate = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional();
const optTime = z.union([z.literal(""), z.string().regex(/^\d{2}:\d{2}$/)]).optional();

export const guestTravelSchema = z.object({
  arrival_date: optDate,
  arrival_time: optTime,
  arrival_airport: z.string().trim().max(10).optional(),
  arrival_flight: z.string().trim().max(20).optional(),
  departure_date: optDate,
  departure_time: optTime,
  departure_airport: z.string().trim().max(10).optional(),
  departure_flight: z.string().trim().max(20).optional(),
  staying_at: z.string().trim().max(200).optional(),
  hotel_id: z.union([z.uuid(), z.literal(""), z.null()]).optional(),
  needs_transfer: z.boolean().optional(),
  transport_notes: z.string().trim().max(500).optional(),
});

export type GuestTravelPayload = z.infer<typeof guestTravelSchema>;

export const sendEmailSchema = z.object({
  householdIds: z.array(z.uuid()).min(1, v("chooseHousehold")).max(1000),
  kind: z.enum(["invitation", "reminder"]),
  note: z.string().trim().max(1000, v("tooLong", 1000)),
});
