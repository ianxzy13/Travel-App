import { z } from "zod";
import { LOCALE_CODES, type Locale } from "@/i18n/locales";
import { isTimeZone } from "@/lib/i18n/format";

export const localeSchema = z.enum(LOCALE_CODES as [Locale, ...Locale[]]);

export const weddingLanguagesSchema = z.object({
  // main language first, no duplicates
  languages: z
    .array(localeSchema)
    .min(1, "Choose at least one language")
    .max(25)
    .refine((l) => new Set(l).size === l.length, "Each language only once"),
  timeZone: z.union([z.literal(""), z.string().max(64).refine(isTimeZone, "Unknown time zone")]),
});
export type WeddingLanguagesValues = z.infer<typeof weddingLanguagesSchema>;

/** { "sl": { "name": "Poroka", "description": "…" } } with only the given text fields. */
export function translationsSchema<F extends string>(fields: readonly F[], max = 2000) {
  const texts = z.object(
    Object.fromEntries(fields.map((f) => [f, z.string().trim().max(max).optional()])) as Record<
      F,
      z.ZodOptional<z.ZodString>
    >,
  );
  return z.record(localeSchema, texts);
}
