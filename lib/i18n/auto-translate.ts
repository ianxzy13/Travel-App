import "server-only";
import { unstable_cache } from "next/cache";

// Machine translation of the couple's own texts for guests (e.g. the RSVP
// welcome message), used where the couple hasn't saved a translation.
// - With DEEPL_API_KEY set, DeepL is used (free plan: 500,000 characters a month).
// - Otherwise Google Translate's free web endpoint, then MyMemory (both free,
//   no key needed, but they can be busy; DeepL is the dependable option).
// Results are cached for 30 days per text and language, so each text is only
// translated once, and a changed text is translated again automatically.

const TIMEOUT_MS = 5000;

// DeepL's target codes differ a little from ours; languages it lacks use Google.
const DEEPL_TARGET: Record<string, string> = {
  ar: "AR",
  cs: "CS",
  de: "DE",
  el: "EL",
  en: "EN-GB",
  es: "ES",
  fr: "FR",
  id: "ID",
  it: "IT",
  ja: "JA",
  ko: "KO",
  nl: "NL",
  pl: "PL",
  pt: "PT-PT",
  ru: "RU",
  sl: "SL",
  sv: "SV",
  tr: "TR",
  uk: "UK",
  "zh-CN": "ZH-HANS",
  "zh-TW": "ZH-HANT",
};

async function deepl(text: string, to: string, key: string) {
  const host = key.endsWith(":fx") ? "api-free.deepl.com" : "api.deepl.com";
  const res = await fetch(`https://${host}/v2/translate`, {
    method: "POST",
    headers: { Authorization: `DeepL-Auth-Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text: [text], target_lang: DEEPL_TARGET[to] }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`DeepL ${res.status}`);
  const json = (await res.json()) as { translations?: { text: string }[] };
  const out = json.translations?.[0]?.text;
  if (!out) throw new Error("DeepL: empty answer");
  return out;
}

async function google(text: string, to: string) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(to)}&dt=t`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: new URLSearchParams({ q: text }).toString(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
    redirect: "manual", // a busy Google answers with a redirect to a captcha
  });
  if (!res.ok) throw new Error(`Google ${res.status}`);
  // [[["translated part", "original part", …], …], …]
  const json = (await res.json()) as [[string, string][]];
  const out = (json?.[0] ?? []).map((part) => part?.[0] ?? "").join("");
  if (!out.trim()) throw new Error("Google: empty answer");
  return out;
}

/** Pieces of at most ~450 bytes (MyMemory's limit is 500), split at lines, then sentences. */
function chunks(text: string) {
  const max = 450;
  const size = (s: string) => new TextEncoder().encode(s).length;
  const out: string[] = [];
  for (const line of text.split("\n")) {
    if (size(line) <= max) {
      out.push(line);
      continue;
    }
    let piece = "";
    for (const sentence of line.match(/[^.!?]+[.!?]*\s*/g) ?? [line]) {
      if (piece && size(piece + sentence) > max) {
        out.push(piece);
        piece = "";
      }
      piece += sentence;
    }
    out.push(piece);
  }
  return out;
}

async function myMemory(text: string, from: string, to: string) {
  if (from === to) throw new Error("MyMemory: same language");
  const email = process.env.MYMEMORY_EMAIL?.trim(); // optional: raises the daily limit
  const parts = await Promise.all(
    chunks(text).map(async (part) => {
      if (!part.trim()) return part;
      const params = new URLSearchParams({ q: part, langpair: `${from}|${to}` });
      if (email) params.set("de", email);
      const res = await fetch(`https://api.mymemory.translated.net/get?${params}`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`MyMemory ${res.status}`);
      const json = (await res.json()) as {
        responseStatus?: number | string;
        responseData?: { translatedText?: string };
      };
      const out = json.responseData?.translatedText;
      if (Number(json.responseStatus) !== 200 || !out) throw new Error("MyMemory: no answer");
      return out;
    }),
  );
  return parts.join("\n");
}

async function translateNow(text: string, from: string, to: string) {
  const key = process.env.DEEPL_API_KEY?.trim();
  const tries: [string, () => Promise<string>][] = [
    ...(key && DEEPL_TARGET[to]
      ? [["DeepL", () => deepl(text, to, key)] as [string, () => Promise<string>]]
      : []),
    ["Google", () => google(text, to)],
    ["MyMemory", () => myMemory(text, from, to)],
  ];
  let last: unknown;
  for (const [name, run] of tries) {
    try {
      return await run();
    } catch (e) {
      console.error(`[auto-translate] ${name} failed`, e);
      last = e;
    }
  }
  throw last;
}

// Errors are not cached, so a failed translation is simply tried again next time.
const cached = unstable_cache(translateNow, ["auto-translate-v1"], {
  revalidate: 60 * 60 * 24 * 30,
});

/**
 * `text` in language `to`, or null if no translator answered. `from` is the
 * language the text is most likely in (most translators detect it themselves).
 */
export async function autoTranslate(
  text: string,
  from: string,
  to: string,
): Promise<string | null> {
  if (!text.trim()) return null;
  try {
    return await cached(text, from, to);
  } catch (e) {
    console.error("[auto-translate]", e);
    return null;
  }
}
