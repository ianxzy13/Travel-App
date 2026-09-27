import { DEFAULT_LOCALE, LOCALE_CODES, isLocale, type Locale } from "./locales";

/**
 * Best supported language from an Accept-Language header
 * ("de-AT,de;q=0.9,en;q=0.8"), optionally only among `allowed`.
 */
export function negotiate(
  header: string | null | undefined,
  allowed: readonly string[] = LOCALE_CODES,
): Locale | null {
  if (!header) return null;
  const wanted = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = Number(params.find((p) => p.trim().startsWith("q="))?.split("=")[1] ?? 1);
      return { tag: tag.trim(), q: Number.isFinite(q) ? q : 0 };
    })
    .filter((w) => w.tag && w.q > 0)
    .sort((a, b) => b.q - a.q);
  const ok = allowed.filter(isLocale);
  for (const { tag } of wanted) {
    const lower = tag.toLowerCase();
    // exact ("zh-TW"), then Chinese variants, then the base language ("de-AT" → "de")
    const exact = ok.find((l) => l.toLowerCase() === lower);
    if (exact) return exact;
    if (lower.startsWith("zh")) {
      const traditional = /zh-(tw|hk|mo|hant)/.test(lower);
      const zh =
        ok.find((l) => l === (traditional ? "zh-TW" : "zh-CN")) ??
        ok.find((l) => l.startsWith("zh"));
      if (zh) return zh;
      continue;
    }
    const base = ok.find((l) => l.toLowerCase() === lower.split("-")[0]);
    if (base) return base;
  }
  return null;
}

/**
 * Which language a public page (website, RSVP, shared board) opens in. Every
 * language Vow speaks is allowed: buttons and dates are always translated, and
 * the couple's texts fall back to their own language where not translated.
 * 1. what the guest explicitly asked for (?lang=… or the switcher)
 * 2. their earlier choice (cookie)
 * 3. the household's language (set by the couple, or chosen on the RSVP page)
 * 4. the browser's language
 * 5. the couple's language
 */
export function resolveGuestLocale(opts: {
  asked?: string | null;
  cookie?: string | null;
  preferred?: string | null;
  acceptLanguage?: string | null;
  weddingLanguages?: readonly string[] | null;
}): Locale {
  const offered = (opts.weddingLanguages ?? []).filter(isLocale);
  if (isLocale(opts.asked)) return opts.asked;
  if (isLocale(opts.cookie)) return opts.cookie;
  if (isLocale(opts.preferred)) return opts.preferred;
  return negotiate(opts.acceptLanguage, LOCALE_CODES) ?? offered[0] ?? DEFAULT_LOCALE;
}

/** The app's language: explicit choice (cookie), else the browser's, else English. */
export function resolveAppLocale(opts: {
  cookie?: string | null;
  acceptLanguage?: string | null;
}): Locale {
  if (isLocale(opts.cookie)) return opts.cookie;
  return negotiate(opts.acceptLanguage) ?? DEFAULT_LOCALE;
}

/** Recursively fills missing keys of `messages` from `fallback` (English). */
export function withFallback<T extends Record<string, unknown>>(
  messages: Partial<T>,
  fallback: T,
): T {
  const out: Record<string, unknown> = { ...fallback };
  for (const [k, v] of Object.entries(messages)) {
    const f = fallback[k];
    out[k] =
      v && typeof v === "object" && !Array.isArray(v) && f && typeof f === "object"
        ? withFallback(v as Record<string, unknown>, f as Record<string, unknown>)
        : v;
  }
  return out as T;
}
