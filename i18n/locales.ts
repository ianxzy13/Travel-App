// The languages Vow speaks. Add one by adding it here and creating
// messages/<code>.json (copy en.json and translate the values).

export const LOCALES = [
  { code: "en", english: "English", native: "English" },
  { code: "es", english: "Spanish", native: "Español" },
  { code: "pt", english: "Portuguese", native: "Português" },
  { code: "fr", english: "French", native: "Français" },
  { code: "de", english: "German", native: "Deutsch" },
  { code: "it", english: "Italian", native: "Italiano" },
  { code: "nl", english: "Dutch", native: "Nederlands" },
  { code: "pl", english: "Polish", native: "Polski" },
  { code: "cs", english: "Czech", native: "Čeština" },
  { code: "sl", english: "Slovenian", native: "Slovenščina" },
  { code: "hr", english: "Croatian", native: "Hrvatski" },
  { code: "sv", english: "Swedish", native: "Svenska" },
  { code: "el", english: "Greek", native: "Ελληνικά" },
  { code: "tr", english: "Turkish", native: "Türkçe" },
  { code: "ru", english: "Russian", native: "Русский" },
  { code: "uk", english: "Ukrainian", native: "Українська" },
  { code: "ar", english: "Arabic", native: "العربية", rtl: true },
  { code: "hi", english: "Hindi", native: "हिन्दी" },
  { code: "zh-CN", english: "Chinese (Simplified)", native: "简体中文" },
  { code: "zh-TW", english: "Chinese (Traditional)", native: "繁體中文" },
  { code: "ja", english: "Japanese", native: "日本語" },
  { code: "ko", english: "Korean", native: "한국어" },
  { code: "id", english: "Indonesian", native: "Bahasa Indonesia" },
  { code: "vi", english: "Vietnamese", native: "Tiếng Việt" },
  { code: "th", english: "Thai", native: "ไทย" },
] as const satisfies readonly { code: string; english: string; native: string; rtl?: boolean }[];

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
