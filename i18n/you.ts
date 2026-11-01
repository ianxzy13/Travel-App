// Guests are spoken to by how many people are in their household: one person
// ("you" singular), two (Slovenian and Arabic have a dual: "vidva") or more.
// A text says so with `{you, select, one {…} two {…} other {…}}` (English
// needs none). The branch is picked when the texts are loaded, so pages and
// emails just get the right words; anywhere the household isn't known
// (the website, the app) the plural (`other`) is used.

export type YouForm = "one" | "two" | "other";

/** How to address a household of `people` (unknown → plural). */
export const youForm = (people: number | null | undefined): YouForm =>
  people === 1 ? "one" : people === 2 ? "two" : "other";

const START = /\{\s*you\s*,\s*select\s*,/g;

/** Text with every `{you, select, …}` replaced by the branch for `form`. */
export function pickYou(text: string, form: YouForm): string {
  if (!text.includes("{you")) return text;
  let out = "";
  let at = 0;
  START.lastIndex = 0;
  for (let m = START.exec(text); m; m = START.exec(text)) {
    out += text.slice(at, m.index);
    // read "key {branch}" pairs up to the closing brace of the select
    const branches: Record<string, string> = {};
    let i = m.index + m[0].length;
    while (i < text.length) {
      while (/\s/.test(text[i])) i++;
      if (text[i] === "}") break;
      const key = /^[\w=]+/.exec(text.slice(i))?.[0];
      if (!key) break;
      i += key.length;
      while (/\s/.test(text[i])) i++;
      if (text[i] !== "{") break;
      let depth = 1;
      const from = ++i;
      for (; i < text.length && depth; i++) {
        if (text[i] === "{") depth++;
        else if (text[i] === "}") depth--;
      }
      branches[key] = text.slice(from, i - 1);
    }
    out += branches[form] ?? (form === "two" ? branches.other : undefined) ?? branches.other ?? "";
    at = i + 1; // past the select's closing brace
    START.lastIndex = at;
  }
  return out + text.slice(at);
}

/** All texts with the `you` choice made (a deep copy only where something changes). */
export function pickYouAll<T>(messages: T, form: YouForm): T {
  if (typeof messages === "string") return pickYou(messages, form) as T;
  if (!messages || typeof messages !== "object") return messages;
  let changed = false;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(messages)) {
    out[k] = pickYouAll(v, form);
    if (out[k] !== v) changed = true;
  }
  return (changed ? out : messages) as T;
}
