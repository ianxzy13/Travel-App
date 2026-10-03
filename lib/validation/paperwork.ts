import { z } from "zod";

export const paperworkItemSchema = z.object({
  person: z.enum(["partner_a", "partner_b", "shared"]),
  title: z.string().min(1).max(200),
  templateKey: z.string().max(60).nullable().optional(),
  status: z.enum([
    "not_started",
    "requested",
    "received",
    "apostilled",
    "translated",
    "submitted",
  ]),
  responsibleId: z.uuid().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  issueDate: z.string().nullable().optional(),
  maxAgeMonths: z.number().int().positive().nullable().optional(),
  sortOrder: z.number().int().default(0),
});

export type PaperworkItemInput = z.infer<typeof paperworkItemSchema>;
