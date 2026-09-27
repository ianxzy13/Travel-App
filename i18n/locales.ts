// The languages Vow speaks. Add one by adding it here (with the country whose
// flag represents it) and creating messages/<code>/ (copy messages/en/ and
// translate the values).

export const LOCALES = [
  { code: "en", english: "English", native: "English", flag: "GB" },
  { code: "es", english: "Spanish", native: "Español", flag: "ES" },
  { code: "pt", english: "Portuguese", native: "Português", flag: "PT" },
  { code: "fr", english: "French", native: "Français", flag: "FR" },
  { code: "de", english: "German", native: "Deutsch", flag: "DE" },
  { code: "it", english: "Italian", native: "Italiano", flag: "IT" },
  { code: "nl", english: "Dutch", native: "Nederlands", flag: "NL" },
  { code: "pl", english: "Polish", native: "Polski", flag: "PL" },
  { code: "cs", english: "Czech", native: "Čeština", flag: "CZ" },
  { code: "sl", english: "Slovenian", native: "Slovenščina", flag: "SI" },
  { code: "hr", english: "Croatian", native: "Hrvatski", flag: "HR" },
  { code: "sv", english: "Swedish", native: "Svenska", flag: "SE" },
  { code: "el", english: "Greek", native: "Ελληνικά", flag: "GR" },
  { code: "tr", english: "Turkish", native: "Türkçe", flag: "TR" },
  { code: "ru", english: "Russian", native: "Русский", flag: "RU" },
  { code: "uk", english: "Ukrainian", native: "Українська", flag: "UA" },
  { code: "ar", english: "Arabic", native: "العربية", flag: "SA", rtl: true },
  { code: "hi", english: "Hindi", native: "हिन्दी", flag: "IN" },
  { code: "zh-CN", english: "Chinese (Simplified)", native: "简体中文", flag: "CN" },
  { code: "zh-TW", english: "Chinese (Traditional)", native: "繁體中文", flag: "TW" },
  { code: "ja", english: "Japanese", native: "日本語", flag: "JP" },
  { code: "ko", english: "Korean", native: "한국어", flag: "KR" },
  { code: "id", english: "Indonesian", native: "Bahasa Indonesia", flag: "ID" },
  { code: "vi", english: "Vietnamese", native: "Tiếng Việt", flag: "VN" },
  { code: "th", english: "Thai", native: "ไทย", flag: "TH" },
] as const satisfies readonly {
  code: string;
  english: string;
  native: string;
  flag: string;
  rtl?: boolean;
}[];

export type Locale = (typeof LOCALES)[number]["code"];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_CODES = LOCALES.map((l) => l.code) as Locale[];

export const isLocale = (v: unknown): v is Locale =>
  typeof v === "string" && (LOCALE_CODES as string[]).includes(v);

export const localeInfo = (code: string) => LOCALES.find((l) => l.code === code) ?? LOCALES[0];
export const isRtl = (code: string) => "rtl" in localeInfo(code);

/** Cookie with the language a guest picked on a public page. */
export const GUEST_LOCALE_COOKIE = "vow_lang";
/** Cookie with the app language a signed-in person picked. */
export const APP_LOCALE_COOKIE = "vow_app_lang";
