import { v } from "@/lib/i18n/validation";
import { z } from "zod";
import { LOCALE_CODES, type Locale } from "@/i18n/locales";
import { isTimeZone } from "@/lib/i18n/format";

export const localeSchema = z.enum(LOCALE_CODES as [Locale, ...Locale[]]);

export const weddingLanguagesSchema = z.object({
  // the language the couple writes their texts in (households' languages are added automatically)
  language: localeSchema,
  timeZone: z.union([z.literal(""), z.string().max(64).refine(isTimeZone, v("timeZone"))]),
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
