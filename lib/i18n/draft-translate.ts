import { draftTranslations } from "@/app/app/settings/language-actions";
import { browserTranslate, canBrowserTranslate } from "./browser-translate";
import { toSlovenianDual } from "./slovenian-dual";

/**
 * A draft translation of one of the couple's texts, for the "Draft" buttons:
 * the server's translator first (works in every browser), else the browser's
 * own translator. Slovenian gets the couple's dual forms either way.
 */
export async function draftTranslate(text: string, from: string, to: string) {
  const r = await draftTranslations({ text }, from, to).catch(() => null);
  if (r?.ok && r.data.text) return r.data.text;
  if (!canBrowserTranslate()) throw new Error("no translator");
  const out = await browserTranslate(text, from, to);
  return to === "sl" ? toSlovenianDual(out) : out;
}
