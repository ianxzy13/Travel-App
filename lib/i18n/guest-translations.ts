import "server-only";
import { createTranslator } from "next-intl";
import { loadMessages } from "@/i18n/messages";
import { youForm } from "@/i18n/you";
import type { createClient } from "@/lib/supabase/server";

/** t(key, values): one namespace's texts, filled in */
type Translator = (key: string, values?: Record<string, string | number | Date>) => string;

/**
 * Texts for an email to one household, in `locale`, speaking to them as one
 * person, two or more (`people`: how many are in the household).
 */
export async function guestTranslations(
  locale: string,
  namespace: "email" | "travelEmail" | "stdEmail",
  people: number | undefined,
): Promise<Translator> {
  const messages = await loadMessages(locale, youForm(people));
  return createTranslator({
    locale: locale as never,
    messages,
    namespace,
  }) as unknown as Translator;
}

/** household id → number of guests in it (plus-ones included). */
export async function householdSizes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  weddingId: string,
  householdIds: string[],
): Promise<Map<string, number>> {
  const sizes = new Map<string, number>();
  for (let i = 0; i < householdIds.length; i += 100) {
    const { data, error } = await supabase
      .from("guests")
      .select("household_id")
      .eq("wedding_id", weddingId)
      .in("household_id", householdIds.slice(i, i + 100));
    if (error) console.error("[householdSizes]", error); // plural is used then
    for (const g of data ?? []) sizes.set(g.household_id, (sizes.get(g.household_id) ?? 0) + 1);
  }
  return sizes;
}
