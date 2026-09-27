// "Draft a translation" with the translator built into some browsers (Chrome
// on desktop, version 138+). It runs on the couple's own computer: free, no
// API key, nothing is sent to us. Where it isn't available the button is hidden.
// A paid translation API (e.g. DeepL) could be added later behind an env variable.

type TranslatorApi = {
  create(opts: {
    sourceLanguage: string;
    targetLanguage: string;
  }): Promise<{ translate(text: string): Promise<string> }>;
  availability?(opts: { sourceLanguage: string; targetLanguage: string }): Promise<string>;
};

const api = () =>
  typeof window !== "undefined"
    ? (window as unknown as { Translator?: TranslatorApi }).Translator
    : undefined;

export const canBrowserTranslate = () => !!api();

/** Translates one text; throws if the browser can't do this language pair. */
export async function browserTranslate(text: string, from: string, to: string) {
  const Translator = api();
  if (!Translator) throw new Error("no translator");
  const pair = { sourceLanguage: from, targetLanguage: to };
  if (Translator.availability && (await Translator.availability(pair)) === "unavailable")
    throw new Error("unavailable");
  const translator = await Translator.create(pair);
  return translator.translate(text);
}
