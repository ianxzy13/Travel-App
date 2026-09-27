import type { Messages } from "@/i18n/messages";

export type ValidationKey = keyof Messages["validation"];

/**
 * Form checks (zod) store a short code instead of an English sentence, e.g.
 * v("email") or v("tooLong", 120); the form shows it in the person's language.
 */
export const v = (key: ValidationKey, n?: number) => (n === undefined ? `v.${key}` : `v.${key}:${n}`);

type T = (key: ValidationKey, values?: { n: number }) => string;

/** A form-check code as text; anything else (already a sentence) is shown as it is. */
export function validationText(t: T, message: string | undefined): string | undefined {
  if (!message) return message;
  const m = message.match(/^v\.(\w+)(?::(\d+))?$/);
  if (!m) return message;
  const key = m[1] as ValidationKey;
  try {
    return m[2] ? t(key, { n: Number(m[2]) }) : t(key, { n: 0 });
  } catch {
    return t("invalid", { n: 0 });
  }
}
