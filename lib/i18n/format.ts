// Language-aware formatting with the built-in Intl API (knows every locale).
// Dates in the database are plain calendar dates ("2027-06-12") and event
// times are local wall-clock times at the venue ("15:00:00"), so everything is
// formatted in UTC to avoid shifting them.

const cache = new Map<string, Intl.DateTimeFormat>();
function dtf(locale: string, opts: Intl.DateTimeFormatOptions) {
  const key = locale + JSON.stringify(opts);
  let f = cache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, { ...opts, timeZone: opts.timeZone ?? "UTC" });
    cache.set(key, f);
  }
  return f;
}

const asUtc = (date: string) => new Date(`${date.slice(0, 10)}T00:00:00Z`);

/** "Saturday, 12 June 2027" (full), "12 June 2027" (long), "12 Jun 2027" (medium), "12/06/2027" (short). */
export function fmtDate(
  date: string | null,
  locale: string,
  style: "full" | "long" | "medium" | "short" = "long",
) {
  if (!date) return "";
  // "short" spells out the year: newer browsers write "24. 5. 27" in some
  // languages (e.g. Slovenian), which is easy to misread.
  const opts: Intl.DateTimeFormatOptions =
    style === "short"
      ? { year: "numeric", month: "numeric", day: "numeric" }
      : { dateStyle: style };
  return dtf(locale, opts).format(asUtc(date));
}

/** "5–9 Mar" (or "28 Feb – 2 Mar"), short and as usual in that language. */
export function fmtDateRange(from: string | null, to: string | null, locale: string) {
  if (!from || !to) return fmtDate(from ?? to, locale, "medium");
  const f = dtf(locale, { day: "numeric", month: "short" });
  return f.formatRange(asUtc(from), asUtc(to));
}

/** "15:00" or "3:00 PM", as usual in that language. */
export function fmtTime(time: string | null, locale: string) {
  if (!time) return "";
  return dtf(locale, { timeStyle: "short" }).format(new Date(`1970-01-01T${time.slice(0, 5)}:00Z`));
}

/**
 * Format a wall-clock time (at `venueTz`) in the viewer's timezone.
 * Returns null when zones match, are missing, or on error.
 */
export function fmtTimeInZone(
  time: string | null,
  locale: string,
  date: string | null,
  venueTz: string | null,
  memberTz: string | null,
) {
  if (!time || !venueTz || !memberTz || venueTz === memberTz) return null;
  try {
    const ref = date ?? "2027-01-15";
    const hhmm = time.slice(0, 5);
    const naiveUtcMs = Date.UTC(
      +ref.slice(0, 4), +ref.slice(5, 7) - 1, +ref.slice(8, 10),
      +hhmm.slice(0, 2), +hhmm.slice(3, 5),
    );
    const venueOffsetMs = tzOffsetMs(naiveUtcMs, venueTz);
    const realUtcMs = naiveUtcMs - venueOffsetMs;
    const formatted = dtf(locale, { timeStyle: "short", timeZone: memberTz }).format(new Date(realUtcMs));
    const abbr = tzAbbr(memberTz, locale, new Date(realUtcMs));
    return abbr ? `${formatted} ${abbr}` : formatted;
  } catch {
    return null;
  }
}

function tzOffsetMs(utcMs: number, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(new Date(utcMs));
  const v = (t: string) => +(parts.find((p) => p.type === t)?.value ?? "0");
  const localMs = Date.UTC(v("year"), v("month") - 1, v("day"), v("hour") % 24, v("minute"), v("second"));
  return localMs - utcMs;
}

function tzAbbr(tz: string, locale: string, d: Date) {
  try {
    const parts = new Intl.DateTimeFormat(locale, { timeZone: tz, timeZoneName: "short" }).formatToParts(d);
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

/** "Saturday, 12 June 2027 · 15:00–16:00" (skips what isn't set). */
export function fmtEventWhen(
  e: { event_date: string | null; start_time: string | null; end_time: string | null },
  locale: string,
  noDate: string,
) {
  const date = e.event_date ? fmtDate(e.event_date, locale, "full") : noDate;
  const start = fmtTime(e.start_time, locale);
  const end = fmtTime(e.end_time, locale);
  const time = start && end ? `${start}–${end}` : start;
  return time ? `${date} · ${time}` : date;
}

export function fmtMoney(amount: number, currency: string, locale: string, cents = false) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: cents ? 2 : 0,
    minimumFractionDigits: cents ? 2 : 0,
  }).format(amount);
}

/** "Euro (€)", "Švicarski frank (CHF)": a currency's name and symbol in that language. */
export function currencyLabel(code: string, locale: string) {
  let name = code;
  let symbol = code;
  try {
    name = new Intl.DisplayNames([locale], { type: "currency" }).of(code) ?? code;
    symbol =
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: code,
        currencyDisplay: "narrowSymbol",
      })
        .formatToParts(0)
        .find((p) => p.type === "currency")?.value ?? code;
  } catch {
    // unknown to this browser: show the code
  }
  const label = name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
  return symbol === code || label.includes(symbol) ? `${label} (${code})` : `${label} (${symbol})`;
}

/** Minutes the zone is ahead of UTC at that moment (e.g. +120 for Ljubljana in summer). */
function zoneOffset(instant: number, timeZone: string) {
  const parts = dtf("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtcMs = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return (asUtcMs - instant) / 60000;
}

/** The real moment of a local date + time in a time zone (e.g. 15:00 in Europe/Ljubljana). */
export function zonedToInstant(date: string, time: string, timeZone: string) {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  // two passes handle daylight-saving changes
  let instant = wall - zoneOffset(wall, timeZone) * 60000;
  instant = wall - zoneOffset(instant, timeZone) * 60000;
  return new Date(instant);
}

/** True if a string is a time zone this browser/server knows (e.g. "Europe/Ljubljana"). */
export function isTimeZone(tz: string | null | undefined) {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** "3 hours ago", "yesterday", "in 2 days" in any language. */
export function relative(iso: string, locale: string, now = Date.now()) {
  const seconds = (new Date(iso).getTime() - now) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return rtf.format(Math.round(seconds), "second");
}
