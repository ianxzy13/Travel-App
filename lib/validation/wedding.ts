import { z } from "zod";

export const CURRENCIES = [
  { code: "EUR", label: "Euro (€)" },
  { code: "USD", label: "US dollar ($)" },
  { code: "GBP", label: "British pound (£)" },
  { code: "CHF", label: "Swiss franc (CHF)" },
  { code: "CAD", label: "Canadian dollar (C$)" },
  { code: "AUD", label: "Australian dollar (A$)" },
  { code: "NZD", label: "New Zealand dollar (NZ$)" },
  { code: "SEK", label: "Swedish krona (kr)" },
  { code: "NOK", label: "Norwegian krone (kr)" },
  { code: "DKK", label: "Danish krone (kr)" },
  { code: "PLN", label: "Polish złoty (zł)" },
  { code: "BRL", label: "Brazilian real (R$)" },
  { code: "MXN", label: "Mexican peso (MX$)" },
  { code: "ZAR", label: "South African rand (R)" },
  { code: "INR", label: "Indian rupee (₹)" },
  { code: "JPY", label: "Japanese yen (¥)" },
] as const;

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

export const ACCENTS = [
  { value: "rose", label: "Dusty rose" },
  { value: "sage", label: "Sage" },
] as const;

const currencyCodes = CURRENCIES.map((c) => c.code) as [string, ...string[]];
const name = z.string().trim().min(1, "Please enter a name").max(80, "That name is a bit long");

/** Shared by the onboarding wizard and the settings page (client + server). */
export const weddingSchema = z.object({
  partnerAName: name,
  partnerBName: name,
  // "" means "we haven't picked a date yet"
  weddingDate: z.union([
    z.literal(""),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Please pick a valid date"),
  ]),
  location: z.string().trim().max(200, "Please keep this under 200 characters"),
  currency: z.enum(currencyCodes, "Please choose a currency"),
  // Kept as text so the input can be empty; converted to a number when saving.
  estimatedGuests: z
    .string()
    .trim()
    .regex(/^\d{0,4}$/, "Please enter a whole number up to 5000"),
  styleTags: z.array(z.string().max(30)).max(12),
  accent: z.enum(["rose", "sage"]),
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
  email: z.email("Please enter a valid email address").max(320),
  role: z.enum(["owner", "editor", "viewer"]),
});

export type InviteFormValues = z.infer<typeof inviteSchema>;

export const ROLE_LABELS = {
  owner: { label: "Owner", description: "Full access, manages collaborators" },
  editor: { label: "Editor", description: "Can add and change everything" },
  viewer: { label: "Viewer", description: "Can look but not change" },
} as const;
