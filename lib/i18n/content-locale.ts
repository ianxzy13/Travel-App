import "server-only";
import { getTranslations } from "next-intl/server";
import { isLocale, type Locale } from "@/i18n/locales";
import type { Messages } from "@/i18n/messages";

/** The language the couple writes their texts in (the wedding's first language). */
export function contentLocale(wedding: { languages?: string[] | null }): Locale {
  const first = wedding.languages?.[0];
  return isLocale(first) ? first : "en";
}

/**
 * Texts the app writes into the couple's plan (suggested to-dos, budget
 * categories, default events…) in the couple's language, not the viewer's.
 */
export function contentTranslations<NS extends keyof Messages>(
  wedding: { languages?: string[] | null },
  namespace: NS,
) {
  return getTranslations({ locale: contentLocale(wedding), namespace });
}
