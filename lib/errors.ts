import "server-only";
import { getTranslations } from "next-intl/server";
import type { Messages } from "@/i18n/messages";
import { validationText } from "@/lib/i18n/validation";

export type ErrorKey = keyof Messages["errors"];

/** A failed action result with a message in the person's language. */
export async function err(key: ErrorKey, values?: Record<string, string | number>) {
  const t = await getTranslations("errors");
  return { ok: false as const, error: t(key, values as never) };
}

/** Log the real error on the server, return a friendly message to the person. */
export async function fail(context: string, error: unknown, key: ErrorKey = "generic") {
  console.error(`[${context}]`, error);
  return err(key);
}

/** The first problem zod found, as text in the person's language. */
export async function invalid(e: { issues: { message: string }[] }) {
  const t = await getTranslations("validation");
  return {
    ok: false as const,
    error: validationText(t as never, e.issues[0]?.message) ?? t("invalid", { n: 0 }),
  };
}

export const noPermission = () => err("noPermission");
