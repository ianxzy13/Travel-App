import { v } from "@/lib/i18n/validation";
import { z } from "zod";

const text = (max: number) => z.string().trim().max(max, v("tooLong", max));

export const songSchema = z.object({
  momentId: z.uuid(),
  title: z.string().trim().min(1, v("songTitle")).max(200, v("tooLong", 200)),
  artist: text(200),
  url: z.union([
    z.literal(""),
    z
      .string()
      .trim()
      .max(500, v("tooLong", 500))
      .regex(/^https:\/\/\S+$/, v("url")),
  ]),
  note: text(500),
  priority: z.enum(["must", "nice", "no"]),
  language: text(10),
});
export type SongValues = z.infer<typeof songSchema>;

export const momentSchema = z.object({
  name: z.string().trim().min(1, v("name")).max(80, v("tooLong", 80)),
  scheduleItemId: z.union([z.uuid(), z.literal("")]),
  hidden: z.boolean(),
});
export type MomentValues = z.infer<typeof momentSchema>;

/** The full order of songs in the moments that changed. */
export const songOrderSchema = z
  .array(z.object({ momentId: z.uuid(), songIds: z.array(z.uuid()).max(500) }))
  .min(1)
  .max(50);

export const momentOrderSchema = z.array(z.uuid()).min(1).max(100);
