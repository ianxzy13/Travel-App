import { z } from "zod";
import { isLocale } from "@/i18n/locales";

const text = (max: number) =>
  z.string().trim().max(max, `Please keep this under ${max} characters`);

const sideSchema = z.enum(["partner_a", "partner_b", "both"]);
const ageGroupSchema = z.enum(["adult", "child", "infant"]);
const listSchema = z.enum(["a", "b"]);

export const addressSchema = z.object({
  line1: text(200),
  line2: text(200),
  city: text(100),
  region: text(100),
  postalCode: text(20),
  country: text(100),
});

export type AddressValues = z.infer<typeof addressSchema>;

export const emptyAddress: AddressValues = {
  line1: "",
  line2: "",
  city: "",
  region: "",
  postalCode: "",
  country: "",
};

/** The add/edit guest form (used by the browser and re-checked on the server). */
export const guestFormSchema = z
  .object({
    /** true when editing a plus-one's own row: name may stay empty */
    isPlusOne: z.boolean(),
    /** "new" to create a household, otherwise an existing household id */
    householdId: z.union([z.literal("new"), z.uuid()]),
    householdName: text(120),
    address: addressSchema,
    firstName: text(80),
    lastName: text(80),
    email: z.union([z.literal(""), z.email("Please enter a valid email address").max(320)]),
    phone: text(50),
    side: sideSchema,
    ageGroup: ageGroupSchema,
    list: listSchema,
    plusOneAllowed: z.boolean(),
    plusOneName: text(160),
    dietary: text(500),
    accessibility: text(500),
    notes: text(2000),
    eventIds: z.array(z.uuid()),
    tagIds: z.array(z.uuid()),
  })
  .refine((v) => v.isPlusOne || v.firstName || v.lastName, {
    path: ["firstName"],
    message: "Please enter a first or last name",
  });

export type GuestFormValues = z.infer<typeof guestFormSchema>;

export const householdSchema = z.object({
  name: text(120).min(1, "Please enter a household name"),
  address: addressSchema,
  // "" = the wedding's main language
  language: z
    .string()
    .refine((v) => v === "" || isLocale(v), "Unknown language")
    .optional(),
});

export type HouseholdFormValues = z.infer<typeof householdSchema>;

export const TAG_COLORS = ["stone", "rose", "sage", "sky", "amber", "violet"] as const;

export const tagSchema = z.object({
  name: text(40).min(1, "Please enter a tag name"),
  color: z.enum(TAG_COLORS),
});

export const bulkPatchSchema = z
  .object({ side: sideSchema, list: listSchema, age_group: ageGroupSchema })
  .partial();

export const relationshipSchema = z.object({
  guestA: z.uuid(),
  guestB: z.uuid("Please choose a guest"),
  type: z.enum(["keep_together", "keep_apart"]),
  note: text(300),
});

/** One row of a CSV import (built by lib/guests/csv.ts mapRows). */
export const importGuestSchema = z.object({
  firstName: text(80),
  lastName: text(80),
  household: text(120).min(1),
  email: z.union([z.literal(""), z.email().max(320)]).catch(""),
  phone: text(50),
  side: sideSchema,
  ageGroup: ageGroupSchema,
  addressLine1: text(200),
  addressLine2: text(200),
  city: text(100),
  region: text(100),
  postalCode: text(20),
  country: text(100),
  tags: z.array(text(40).min(1)).max(20),
  events: z.array(text(100)).max(20),
  dietary: text(500),
  accessibility: text(500),
  notes: text(2000),
  plusOneAllowed: z.boolean(),
  plusOneName: text(160),
  plusOneOf: text(160),
  list: listSchema,
});

export const MAX_IMPORT_ROWS = 2000;
export const importSchema = z
  .array(importGuestSchema)
  .min(1, "There are no guests to import")
  .max(MAX_IMPORT_ROWS, `Please import at most ${MAX_IMPORT_ROWS} guests at a time`);

// ---------- events ----------

export const eventSchema = z.object({
  name: text(100).min(1, "Please enter a name"),
  eventDate: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date")]),
  startTime: z.union([z.literal(""), z.string().regex(/^\d{2}:\d{2}$/, "Invalid time")]),
  endTime: z.union([z.literal(""), z.string().regex(/^\d{2}:\d{2}$/, "Invalid time")]),
  venueName: text(200),
  address: text(300),
  dressCode: text(200),
  description: text(2000),
});

export type EventFormValues = z.infer<typeof eventSchema>;
