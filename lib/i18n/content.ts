import type { SiteSectionKind, Translations } from "@/lib/database.types";

// Per-language versions of the couple's own texts (website sections, events,
// meals…). Translations only hold texts; photos, order and the list of items
// always come from the main language. List items are matched by their id:
//   { "intro": "…", "items": { "<faq item id>": { "question": "…", "answer": "…" } } }

type Spec = { fields: string[]; lists?: Record<string, string[]> };

export const TRANSLATABLE: Record<SiteSectionKind, Spec> = {
  home: { fields: ["tagline"] },
  story: { fields: ["intro"], lists: { milestones: ["date", "title", "text"] } },
  events: { fields: ["intro"] },
  travel: { fields: ["intro", "notes"] },
  rsvp: { fields: ["intro"] },
  party: { fields: [], lists: { people: ["role", "bio"] } },
  registry: { fields: ["intro"], lists: { links: ["label", "note"] } },
  faq: { fields: [], lists: { items: ["question", "answer"] } },
  gallery: { fields: [], lists: { photos: ["caption"] } },
};

type Obj = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const has = (v: unknown) => str(v).trim() !== "";

/** Section content in one language: translated texts where they exist, the main language elsewhere. */
export function localizeContent<T extends Obj>(
  kind: SiteSectionKind,
  content: T,
  translation: Obj | undefined,
): T {
  if (!translation) return content;
  const spec = TRANSLATABLE[kind];
  const out: Obj = { ...content };
  for (const f of spec.fields) if (has(translation[f])) out[f] = translation[f];
  for (const [list, fields] of Object.entries(spec.lists ?? {})) {
    const items = (translation[list] ?? {}) as Record<string, Obj>;
    out[list] = ((content[list] as Obj[]) ?? []).map((item) => {
      const tr = items[str(item.id)];
      if (!tr) return item;
      const copy = { ...item };
      for (const f of fields) if (has(tr[f])) copy[f] = tr[f];
      return copy;
    });
  }
  return out as T;
}

/** How many of the section's texts have a translation (only texts that exist in the main language count). */
export function translationProgress(
  kind: SiteSectionKind,
  content: Obj,
  translation: Obj | undefined,
) {
  const spec = TRANSLATABLE[kind];
  let total = 0;
  let done = 0;
  for (const f of spec.fields) {
    if (!has(content[f])) continue;
    total++;
    if (has(translation?.[f])) done++;
  }
  for (const [list, fields] of Object.entries(spec.lists ?? {})) {
    const items = (translation?.[list] ?? {}) as Record<string, Obj>;
    for (const item of (content[list] as Obj[]) ?? []) {
      for (const f of fields) {
        if (!has(item[f])) continue;
        total++;
        if (has(items[str(item.id)]?.[f])) done++;
      }
    }
  }
  return { done, total };
}

/** Removes empty strings and empty objects, so stored translations stay small. */
export function pruneTranslation(t: Obj): Obj {
  const out: Obj = {};
  for (const [k, v] of Object.entries(t)) {
    if (typeof v === "string") {
      if (v.trim()) out[k] = v;
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      const inner = pruneTranslation(v as Obj);
      if (Object.keys(inner).length) out[k] = inner;
    }
  }
  return out;
}

/**
 * A row's texts in one language (events, meal options, wedding details):
 * the translated value where there is one, the original otherwise.
 */
export function localized<T extends Obj>(
  row: T & { translations?: Translations | null },
  locale: string,
  fields: (keyof T & string)[],
): T {
  const tr = row.translations?.[locale];
  if (!tr) return row;
  const out: Obj = { ...row };
  for (const f of fields) if (has(tr[f])) out[f] = tr[f];
  return out as T;
}

export const EVENT_TEXT_FIELDS = ["name", "venue_name", "dress_code", "description"] as const;
export const MEAL_TEXT_FIELDS = ["name", "description"] as const;
export const WEDDING_TEXT_FIELDS = ["location", "rsvp_contact"] as const;

/** Keeps only the texts a section can translate (strings, limited length); anything else is dropped. */
export function sanitizeTranslation(kind: SiteSectionKind, raw: unknown, max = 3000): Obj {
  if (!raw || typeof raw !== "object") return {};
  const src = raw as Obj;
  const spec = TRANSLATABLE[kind];
  const out: Obj = {};
  for (const f of spec.fields)
    if (typeof src[f] === "string") out[f] = (src[f] as string).slice(0, max);
  for (const [list, fields] of Object.entries(spec.lists ?? {})) {
    const items = src[list];
    if (!items || typeof items !== "object") continue;
    const cleanItems: Obj = {};
    for (const [itemId, item] of Object.entries(items as Record<string, Obj>).slice(0, 100)) {
      if (!item || typeof item !== "object" || itemId.length > 64) continue;
      const c: Obj = {};
      for (const f of fields)
        if (typeof item[f] === "string") c[f] = (item[f] as string).slice(0, max);
      cleanItems[itemId] = c;
    }
    out[list] = cleanItems;
  }
  return pruneTranslation(out);
}
