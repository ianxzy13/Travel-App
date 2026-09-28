import { v } from "@/lib/i18n/validation";
import { z } from "zod";

const text = (max: number) => z.string().trim().max(max, v("tooLong", max));
const size = z.number().int().min(1).max(20000).nullable();

export const boardSchema = z.object({
  name: text(60).min(1, v("name")),
  description: text(300),
});

export const uploadPinSchema = z.object({
  boardId: z.uuid(),
  path: z.string().max(500),
  width: size,
  height: size,
  title: text(200),
});

export const linkPinSchema = z.object({
  boardId: z.uuid(),
  imageUrl: z.url().max(2000).startsWith("https://", v("https")),
  sourceUrl: z.union([z.literal(""), z.url().max(2000)]),
  title: text(200),
  width: size,
  height: size,
});

export const pinUpdateSchema = z.object({
  title: text(200),
  note: text(2000),
  sourceUrl: z.union([z.literal(""), z.url(v("url")).max(2000)]),
  tags: z.array(text(40)).max(20),
  status: z.enum(["love", "maybe"]).nullable(),
  budgetCategoryId: z.uuid().nullable(),
  vendorId: z.uuid().nullable(),
});
export type PinUpdate = z.infer<typeof pinUpdateSchema>;

export const hexList = z
  .array(z.string().regex(/^#[0-9a-f]{6}$/i))
  .min(1)
  .max(12);
