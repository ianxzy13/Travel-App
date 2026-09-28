import { v } from "@/lib/i18n/validation";
import { z } from "zod";

const text = (max: number) => z.string().trim().max(max, v("tooLong", max));
const date = z.union([z.literal(""), z.iso.date(v("date"))]);

export const taskSchema = z.object({
  title: text(200).min(1, v("todo")),
  notes: text(4000),
  due_date: date,
  assignee_id: z.union([z.literal(""), z.uuid()]),
  category: text(40),
});
export type TaskValues = z.infer<typeof taskSchema>;

export const scheduleItemSchema = z.object({
  day: date,
  start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, v("time")),
  duration_min: z.union([z.literal(""), z.coerce.number().int().min(0).max(1440)]),
  title: text(150).min(1, v("itemName")),
  location: text(200),
  owner: text(120),
  notes: text(2000),
  vendor_id: z.union([z.literal(""), z.uuid()]),
});
export type ScheduleItemValues = z.input<typeof scheduleItemSchema>;
