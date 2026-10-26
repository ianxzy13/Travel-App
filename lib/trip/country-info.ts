// Practical facts about a wedding's destination country, for the guest travel checklist.
// Countries not listed here simply skip the currency / plug / emergency items.

export type CountryInfo = {
  /** ISO 4217 currency code (the name is shown with Intl, in the guest's language). */
  currency: string;
  /** Plug types, e.g. ["C", "F"]. */
  plugs: string[];
  volts: number;
  /** Emergency number(s) as dialled locally. */
  emergency?: string;
};

const EU_STANDARD = { plugs: ["C", "F"], volts: 230, emergency: "112" };

export const COUNTRY_INFO: Record<string, CountryInfo> = {
  // Europe
  AD: { currency: "EUR", ...EU_STANDARD },
  AL: { currency: "ALL", ...EU_STANDARD },
  AM: { currency: "AMD", ...EU_STANDARD },
  AT: { currency: "EUR", ...EU_STANDARD },
  AZ: { currency: "AZN", plugs: ["C", "F"], volts: 220, emergency: "112" },
  BA: { currency: "BAM", ...EU_STANDARD },
  BE: { currency: "EUR", plugs: ["C", "E"], volts: 230, emergency: "112" },
  BG: { currency: "EUR", ...EU_STANDARD },
  CH: { currency: "CHF", plugs: ["C", "J"], volts: 230, emergency: "112" },
  CY: { currency: "EUR", plugs: ["G"], volts: 230, emergency: "112" },
  CZ: { currency: "CZK", plugs: ["C", "E"], volts: 230, emergency: "112" },
  DE: { currency: "EUR", ...EU_STANDARD },
  DK: { currency: "DKK", plugs: ["C", "E", "F", "K"], volts: 230, emergency: "112" },
  EE: { currency: "EUR", ...EU_STANDARD },
  ES: { currency: "EUR", ...EU_STANDARD },
  FI: { currency: "EUR", ...EU_STANDARD },
  FR: { currency: "EUR", plugs: ["C", "E"], volts: 230, emergency: "112" },
  GB: { currency: "GBP", plugs: ["G"], volts: 230, emergency: "999 / 112" },
  GE: { currency: "GEL", plugs: ["C", "F"], volts: 220, emergency: "112" },
  GR: { currency: "EUR", ...EU_STANDARD },
  HR: { currency: "EUR", ...EU_STANDARD },
  HU: { currency: "HUF", ...EU_STANDARD },
  IE: { currency: "EUR", plugs: ["G"], volts: 230, emergency: "112 / 999" },
  IS: { currency: "ISK", ...EU_STANDARD },
  IT: { currency: "EUR", plugs: ["C", "F", "L"], volts: 230, emergency: "112" },
  LI: { currency: "CHF", plugs: ["C", "J"], volts: 230, emergency: "112" },
  LT: { currency: "EUR", ...EU_STANDARD },
  LU: { currency: "EUR", ...EU_STANDARD },
  LV: { currency: "EUR", ...EU_STANDARD },
  MC: { currency: "EUR", plugs: ["C", "E", "F"], volts: 230, emergency: "112" },
  MD: { currency: "MDL", ...EU_STANDARD },
  ME: { currency: "EUR", ...EU_STANDARD },
  MK: { currency: "MKD", ...EU_STANDARD },
  MT: { currency: "EUR", plugs: ["G"], volts: 230, emergency: "112" },
  NL: { currency: "EUR", ...EU_STANDARD },
  NO: { currency: "NOK", ...EU_STANDARD },
  PL: { currency: "PLN", plugs: ["C", "E"], volts: 230, emergency: "112" },
  PT: { currency: "EUR", ...EU_STANDARD },
  RO: { currency: "RON", ...EU_STANDARD },
  RS: { currency: "RSD", ...EU_STANDARD },
  SE: { currency: "SEK", ...EU_STANDARD },
  SI: { currency: "EUR", ...EU_STANDARD },
  SK: { currency: "EUR", plugs: ["C", "E"], volts: 230, emergency: "112" },
  SM: { currency: "EUR", plugs: ["C", "F", "L"], volts: 230, emergency: "112" },
  TR: { currency: "TRY", ...EU_STANDARD },
  UA: { currency: "UAH", ...EU_STANDARD },

  // Americas & Caribbean
  AR: { currency: "ARS", plugs: ["C", "I"], volts: 220, emergency: "911" },
  BS: { currency: "BSD", plugs: ["A", "B"], volts: 120, emergency: "919 / 911" },
  BR: { currency: "BRL", plugs: ["C", "N"], volts: 127 },
  CA: { currency: "CAD", plugs: ["A", "B"], volts: 120, emergency: "911" },
  CL: { currency: "CLP", plugs: ["C", "L"], volts: 220 },
  CO: { currency: "COP", plugs: ["A", "B"], volts: 110, emergency: "123" },
  CR: { currency: "CRC", plugs: ["A", "B"], volts: 120, emergency: "911" },
  DO: { currency: "DOP", plugs: ["A", "B"], volts: 120, emergency: "911" },
  EC: { currency: "USD", plugs: ["A", "B"], volts: 120, emergency: "911" },
  JM: { currency: "JMD", plugs: ["A", "B"], volts: 110, emergency: "119" },
  MX: { currency: "MXN", plugs: ["A", "B"], volts: 127, emergency: "911" },
  PA: { currency: "USD", plugs: ["A", "B"], volts: 120, emergency: "911" },
  PE: { currency: "PEN", plugs: ["A", "B", "C"], volts: 220, emergency: "105" },
  US: { currency: "USD", plugs: ["A", "B"], volts: 120, emergency: "911" },
  UY: { currency: "UYU", plugs: ["C", "F", "I", "L"], volts: 220, emergency: "911" },

  // Asia, Middle East, Africa, Oceania
  AE: { currency: "AED", plugs: ["G", "C", "D"], volts: 230, emergency: "999" },
  AU: { currency: "AUD", plugs: ["I"], volts: 230, emergency: "000" },
  CN: { currency: "CNY", plugs: ["A", "C", "I"], volts: 220, emergency: "110 / 120" },
  EG: { currency: "EGP", plugs: ["C", "F"], volts: 220, emergency: "122 / 123" },
  FJ: { currency: "FJD", plugs: ["I"], volts: 240, emergency: "911" },
  HK: { currency: "HKD", plugs: ["G"], volts: 220, emergency: "999" },
  ID: { currency: "IDR", plugs: ["C", "F"], volts: 230, emergency: "112" },
  IL: { currency: "ILS", plugs: ["C", "H"], volts: 230, emergency: "100 / 101" },
  IN: { currency: "INR", plugs: ["C", "D", "M"], volts: 230, emergency: "112" },
  JO: { currency: "JOD", plugs: ["C", "D", "F", "G", "J"], volts: 230, emergency: "911" },
  JP: { currency: "JPY", plugs: ["A", "B"], volts: 100, emergency: "110 / 119" },
  KE: { currency: "KES", plugs: ["G"], volts: 240, emergency: "999 / 112" },
  KR: { currency: "KRW", plugs: ["C", "F"], volts: 220, emergency: "112 / 119" },
  LK: { currency: "LKR", plugs: ["D", "G"], volts: 230 },
  MA: { currency: "MAD", plugs: ["C", "E"], volts: 220 },
  MU: { currency: "MUR", plugs: ["C", "G"], volts: 230, emergency: "999" },
  MV: { currency: "MVR", plugs: ["D", "G"], volts: 230 },
  MY: { currency: "MYR", plugs: ["G"], volts: 240, emergency: "999" },
  NZ: { currency: "NZD", plugs: ["I"], volts: 230, emergency: "111" },
  PH: { currency: "PHP", plugs: ["A", "B", "C"], volts: 220, emergency: "911" },
  QA: { currency: "QAR", plugs: ["D", "G"], volts: 240, emergency: "999" },
  SC: { currency: "SCR", plugs: ["G"], volts: 240, emergency: "999" },
  SG: { currency: "SGD", plugs: ["G"], volts: 230, emergency: "999 / 995" },
  TH: { currency: "THB", plugs: ["A", "B", "C", "O"], volts: 230, emergency: "191 / 1669" },
  TN: { currency: "TND", plugs: ["C", "E"], volts: 230 },
  TW: { currency: "TWD", plugs: ["A", "B"], volts: 110, emergency: "110 / 119" },
  TZ: { currency: "TZS", plugs: ["D", "G"], volts: 230, emergency: "112" },
  VN: { currency: "VND", plugs: ["A", "C"], volts: 220 },
  ZA: { currency: "ZAR", plugs: ["C", "M", "N"], volts: 230 },
};

/** EU + EEA + Switzerland: free movement, ID card is enough between them. */
export const EU_EEA_CH = new Set([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
  "IS",
  "LI",
  "NO",
  "CH",
]);

/** Arriving here means crossing the Schengen border (EES / ETIAS apply). */
export const SCHENGEN_ENTRY = new Set([
  "AT",
  "BE",
  "BG",
  "HR",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IS",
  "IT",
  "LV",
  "LI",
  "LT",
  "LU",
  "MT",
  "NL",
  "NO",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
  "CH",
  "MC",
  "SM",
  "VA",
]);

/** US Visa Waiver Program: these citizens use an ESTA instead of a visa. */
export const US_VISA_WAIVER = new Set([
  "AD",
  "AU",
  "AT",
  "BE",
  "BN",
  "CL",
  "HR",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IS",
  "IE",
  "IL",
  "IT",
  "JP",
  "LV",
  "LI",
  "LT",
  "LU",
  "MT",
  "MC",
  "NL",
  "NZ",
  "NO",
  "PL",
  "PT",
  "QA",
  "RO",
  "SM",
  "SG",
  "SK",
  "SI",
  "KR",
  "ES",
  "SE",
  "CH",
  "TW",
  "GB",
]);

/** English country names and common short forms, for spotting a country in a free-text location. */
const ALIASES: Record<string, string> = {
  usa: "US",
  "u.s.a": "US",
  "united states": "US",
  uk: "GB",
  england: "GB",
  scotland: "GB",
  wales: "GB",
  "great britain": "GB",
  "punta cana": "DO",
  "santo domingo": "DO",
  "la romana": "DO",
  cancun: "MX",
  cancún: "MX",
  tulum: "MX",
  slovenija: "SI",
  hrvatska: "HR",
  italia: "IT",
  españa: "ES",
  deutschland: "DE",
};

/**
 * Best guess at the wedding's country: the destination airport's country if set,
 * otherwise a country named in the free-text location ("Punta Cana, Dominican Republic").
 */
export function guessCountryFromLocation(location: string | null | undefined): string | null {
  if (!location) return null;
  const text = location.toLowerCase();
  // Look from the end: "City, Region, Country" usually names the country last.
  const parts = text
    .split(/[,\n]/)
    .map((p) => p.trim())
    .filter(Boolean)
    .reverse();
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  const byName = new Map<string, string>();
  for (const cc of Object.keys(COUNTRY_INFO)) {
    const n = names.of(cc);
    if (n) byName.set(n.toLowerCase(), cc);
  }
  for (const [alias, cc] of Object.entries(ALIASES)) byName.set(alias, cc);
  for (const part of parts) {
    const exact = byName.get(part);
    if (exact) return exact;
  }
  // Fall back to a country name anywhere in the text (longest names first).
  const sorted = [...byName.keys()].sort((a, b) => b.length - a.length);
  for (const name of sorted) {
    if (name.length >= 4 && new RegExp(`\\b${escapeRe(name)}\\b`).test(text)) {
      return byName.get(name)!;
    }
  }
  return null;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
