import { v } from "@/lib/i18n/validation";
import { z } from "zod";

/** Currencies couples can plan in (names and symbols come from the browser, in each language). */
export const CURRENCIES = [
  "EUR", "USD", "GBP", "CHF", "CAD", "AUD", "NZD", "SEK", "NOK", "DKK", "ISK", "PLN", "CZK",
  "HUF", "RON", "BGN", "RSD", "BAM", "MKD", "ALL", "TRY", "RUB", "UAH", "GEL", "AED", "SAR",
  "QAR", "KWD", "BHD", "OMR", "JOD", "ILS", "EGP", "MAD", "TND", "ZAR", "NGN", "KES", "GHS",
  "INR", "PKR", "BDT", "LKR", "NPR", "CNY", "HKD", "TWD", "JPY", "KRW", "SGD", "MYR", "THB",
  "IDR", "PHP", "VND", "BRL", "MXN", "ARS", "CLP", "COP", "PEN", "UYU", "DOP", "CRC",
] as const;

/** Stored in English in the database; shown translated (see messages "weddingForm.styles"). */
export const STYLE_TAGS = [
  "Classic",
  "Modern",
  "Romantic",
  "Rustic",
  "Boho",
  "Garden",
  "Beach",
  "Glam",
  "Minimal",
  "Vintage",
  "Destination",
  "Intimate",
] as const;

export const ACCENTS = ["rose", "sage"] as const;

const name = z.string().trim().min(1, v("name")).max(80, v("tooLong", 80));

/** Shared by the onboarding wizard and the settings page (client + server). */
export const weddingSchema = z.object({
  partnerAName: name,
  partnerBName: name,
  // "" means "we haven't picked a date yet"
  weddingDate: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, v("date"))]),
  location: z.string().trim().max(200, v("tooLong", 200)),
  currency: z.string().regex(/^[A-Z]{3}$/, v("currency")),
  // Kept as text so the input can be empty; converted to a number when saving.
  estimatedGuests: z
    .string()
    .trim()
    .regex(/^\d{0,4}$/, v("guestCount")),
  styleTags: z.array(z.string().max(30)).max(12),
  accent: z.enum(ACCENTS),
});

export type WeddingFormValues = z.infer<typeof weddingSchema>;

export const emptyWedding: WeddingFormValues = {
  partnerAName: "",
  partnerBName: "",
  weddingDate: "",
  location: "",
  currency: "EUR",
  estimatedGuests: "",
  styleTags: [],
  accent: "rose",
};

/** Converts validated form values into database column values. */
export function toWeddingColumns(v: WeddingFormValues) {
  const guests = v.estimatedGuests === "" ? null : Math.min(Number(v.estimatedGuests), 5000);
  return {
    partner_a_name: v.partnerAName,
    partner_b_name: v.partnerBName,
    wedding_date: v.weddingDate || null,
    location: v.location || null,
    currency: v.currency,
    estimated_guests: guests,
    style_tags: v.styleTags,
    accent: v.accent,
  };
}

export const inviteSchema = z.object({
  email: z.email(v("email")).max(320),
  role: z.enum(["owner", "editor", "viewer"]),
});

export type InviteFormValues = z.infer<typeof inviteSchema>;

/** Collaborator roles (labels and descriptions are in messages "roles"). */
export const ROLES = ["owner", "editor", "viewer"] as const;
