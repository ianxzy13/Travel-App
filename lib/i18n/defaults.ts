import "server-only";
import { LOCALE_CODES } from "@/i18n/locales";
import { loadMessages, type Messages } from "@/i18n/messages";

/**
 * Starter texts the app writes into a couple's plan (default events, suggested
 * to-dos, budget categories, the day-of template, website greeting and sample
 * questions) are saved in the language that was active when they were created.
 * While nobody has changed them, they are shown in the reader's language
 * instead: the couple sees them in their app language, guests in theirs.
 * A text the couple has edited is theirs and is always shown as written.
 */

// Message groups whose texts are starter texts (every key below each path).
const GROUPS = [
  "onboarding.defaults",
  "tasks.suggestions",
  "tasks.categories",
  "schedule.template",
  "schedule.owners",
  "budget.suggested",
] as const;

type Tree = Record<string, unknown>;
const get = (tree: unknown, path: string) =>
  path.split(".").reduce<unknown>((o, k) => (o as Tree | undefined)?.[k], tree);

/** Same text regardless of case, spacing or ’ vs ' (the database defaults use plain quotes). */
const norm = (s: string) =>
  s.normalize("NFC").replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();

let index: Promise<Map<string, string[]>> | null = null;

/** normalised starter text (in any language) → the message paths it appears at */
function starterIndex() {
  index ??= (async () => {
    const map = new Map<string, string[]>();
    for (const locale of LOCALE_CODES) {
      const messages = await loadMessages(locale);
      for (const group of GROUPS) {
        const node = get(messages, group);
        if (!node || typeof node !== "object") continue;
        for (const [key, text] of Object.entries(node as Tree)) {
          if (typeof text !== "string" || !text.trim()) continue;
          const n = norm(text);
          const path = `${group}.${key}`;
          const paths = map.get(n) ?? [];
          if (!paths.includes(path)) map.set(n, [...paths, path]);
        }
      }
    }
    return map;
  })();
  return index;
}

/**
 * Returns a function that shows untouched starter texts in `locale`:
 *   const shown = await starterTexts("sl"); shown("Ceremony") === "Poročni obred"
 * Anything else comes back unchanged. A few words are starter texts in two
 * places ("Ceremony" is an event and a to-do category); `group` picks one.
 */
export async function starterTexts(locale: string) {
  const [map, messages] = await Promise.all([starterIndex(), loadMessages(locale)]);
  return function shown<T extends string | null | undefined>(
    text: T,
    group: (typeof GROUPS)[number] = GROUPS[0],
  ): T {
    if (!text) return text;
    const paths = map.get(norm(text));
    if (!paths?.length) return text;
    const path = paths.find((p) => p.startsWith(group + ".")) ?? paths[0];
    const translated = get(messages as Messages, path);
    return (typeof translated === "string" && translated.trim() ? translated : text) as T;
  };
}

export type StarterTexts = Awaited<ReturnType<typeof starterTexts>>;

type Content = Record<string, unknown>;

/** Website texts the app pre-fills: the home greeting, the RSVP intro and the sample questions. */
export function starterContent<T extends Content>(
  kind: string,
  content: T,
  shown: StarterTexts,
): T {
  const text = (v: unknown) => (typeof v === "string" ? shown(v) : v);
  if (kind === "home") return { ...content, tagline: text(content.tagline) };
  if (kind === "rsvp") return { ...content, intro: text(content.intro) };
  if (kind === "faq" && Array.isArray(content.items))
    return {
      ...content,
      items: (content.items as Content[]).map((item) => ({
        ...item,
        question: text(item.question),
      })),
    };
  return content;
}
