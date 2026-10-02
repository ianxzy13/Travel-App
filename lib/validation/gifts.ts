import { v } from "@/lib/i18n/validation";
import { z } from "zod";

const text = (max: number) => z.string().trim().max(max, v("tooLong", max));
const date = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, v("date"))]);

export const GIFT_CATEGORIES = ["cash", "registry", "handmade", "experience", "other"] as const;

export const giftSchema = z.object({
  description: text(200).min(1, v("name")),
  amount: z.number().finite().min(0, v("negative")).max(9_999_999_999, v("tooLarge")).nullable(),
  householdId: z.uuid().nullable(),
  fromName: text(120).min(1, v("name")),
  category: z.enum(GIFT_CATEGORIES),
  receivedOn: date,
  thankYouSent: z.boolean(),
  thankYouSentOn: date,
  notes: text(500),
});
export type GiftValues = z.infer<typeof giftSchema>;
