import { z } from "zod";

const money = z
  .number()
  .finite()
  .min(0, "Amounts can't be negative")
  .max(9_999_999_999, "That amount is too large");
const text = (max: number) =>
  z.string().trim().max(max, `Please keep this under ${max} characters`);
const date = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date")]);

/** A file already uploaded to storage: its path and original name. */
export const fileRefSchema = z
  .object({ path: z.string().max(500), name: z.string().max(200) })
  .nullable();
export type FileRef = z.infer<typeof fileRefSchema>;

export const categorySchema = z.object({
  name: text(60).min(1, "Please enter a name"),
  allocated: money,
});

export const paymentSchema = z.object({
  amount: z.number().finite().positive("Payments must be more than 0").max(9_999_999_999),
  dueDate: date,
  paid: z.boolean(),
  paidOn: date,
  note: text(200),
});
export type PaymentValues = z.infer<typeof paymentSchema>;

export const expenseSchema = z.object({
  categoryId: z.uuid("Please choose a category"),
  vendorId: z.uuid().nullable(),
  name: text(120).min(1, "Please enter a name"),
  estimated: money,
  actual: money.nullable(),
  notes: text(4000),
  receipt: fileRefSchema,
  payments: z.array(paymentSchema).max(50),
});
export type ExpenseValues = z.infer<typeof expenseSchema>;

export const VENDOR_STATUS_VALUES = [
  "researching",
  "contacted",
  "quoted",
  "booked",
  "rejected",
] as const;

export const vendorSchema = z.object({
  name: text(120).min(1, "Please enter a name"),
  categoryId: z.uuid().nullable(),
  contactName: text(120),
  email: z.union([z.literal(""), z.email("Please enter a valid email").max(320)]),
  phone: text(50),
  website: z.union([
    z.literal(""),
    z.url("Please enter a full web address, e.g. https://…").max(300),
  ]),
  instagram: text(100),
  address: text(300),
  quote: money.nullable(),
  status: z.enum(VENDOR_STATUS_VALUES),
  notes: text(4000),
  contract: fileRefSchema,
});
export type VendorValues = z.infer<typeof vendorSchema>;
