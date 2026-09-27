import { z } from "zod";

const text = (max: number) =>
  z.string().trim().max(max, `Please keep this under ${max} characters`);
const date = z.union([z.literal(""), z.iso.date("Please pick a date")]);

export const taskSchema = z.object({
  title: text(200).min(1, "Please describe the to-do"),
  notes: text(4000),
  due_date: date,
  assignee_id: z.union([z.literal(""), z.uuid()]),
  category: text(40),
});
export type TaskValues = z.infer<typeof taskSchema>;

export const scheduleItemSchema = z.object({
  day: date,
  start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Please enter a time like 15:30"),
  duration_min: z.union([z.literal(""), z.coerce.number().int().min(0).max(1440)]),
  title: text(150).min(1, "Please give it a name"),
  location: text(200),
  owner: text(120),
  notes: text(2000),
  vendor_id: z.union([z.literal(""), z.uuid()]),
});
export type ScheduleItemValues = z.input<typeof scheduleItemSchema>;
