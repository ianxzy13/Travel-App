// Slovenian has a dual: two people speak of themselves differently from three
// or more. A couple says "poročila se bova" and "veseliva se", not "poročili
// se bomo" / "veselimo se". Machine translators almost always pick the plural,
// so texts the couple writes (welcome message, thank-you…) are fixed here.
// The rules only touch clear first-person forms: "we" (smo/bomo + verbs in
// -mo), "us" (nas/nam/nami) and "our" (naš…). "You" (vi, vas, ste) stays as is.

/** pronoun "us" and possessive "our": plural → dual */
const WORDS: Record<string, string> = {
  nas: "naju",
  nam: "nama",
  nami: "nama",
  smo: "sva",
  bomo: "bova",
  nismo: "nisva",
  naš: "najin",
  naša: "najina",
  naše: "najine",
  naši: "najini",
  našo: "najino",
  našega: "najinega",
  našemu: "najinemu",
  našem: "najinem",
  našim: "najinim",
  naših: "najinih",
  našima: "najinima",
  našimi: "najinimi",
};

// Common verbs in wedding messages, "we …" (-mo) → dual (-va). Kept to a list
// on purpose: "vidimo se" or "praznujmo" include the guests and stay plural.
const VERBS = [
  "veselimo",
  "želimo",
  "čakamo",
  "vabimo",
  "upamo",
  "prosimo",
  "zahvaljujemo",
  "imamo",
  "nimamo",
  "poročimo",
  "sporočamo",
  "obveščamo",
  "pričakujemo",
  "potrebujemo",
  "načrtujemo",
  "hočemo",
  "moramo",
  "smemo",
  "moremo",
  "gremo",
  "pripravljamo",
  "organiziramo",
  "cenimo",
  "ljubimo",
  "zahvalimo",
  "radujemo",
];

// "we celebrate with you" is the couple; "let's celebrate together" is everyone
const WITH_YOU = ["praznujemo", "plešemo", "nazdravimo", "proslavimo"];

const AUX = new Set(["smo", "bomo", "nismo", "sva", "bova", "nisva"]);
// "-li" words that are not "we did …" participles
const NOT_PARTICIPLE = new Set(["ali", "koli", "doli", "boli", "zgoli", "mali", "sami", "naši"]);
// "we are …" adjectives (other -ni words, e.g. "na poročni zabavi", stay as they are)
const ADJECTIVES = new Set([
  "srečni",
  "hvaležni",
  "navdušeni",
  "ponosni",
  "počaščeni",
  "žalostni",
  "pripravljeni",
  "zaročeni",
  "poročeni",
  "zaljubljeni",
  "presrečni",
  "ganjeni",
  "radovedni",
  "radi",
  "sami",
]);
const YOU = new Set([
  "vi",
  "vas",
  "vam",
  "vami",
  "ste",
  "boste",
  "niste",
  "vaš",
  "vaša",
  "vaše",
  "vaši",
  "vašo",
  "vašega",
  "vaših",
]);
// after these, "-li" is a place ("v šoli"), not a participle
const PREPOSITIONS = new Set(["v", "na", "pri", "o", "po", "ob"]);

const keepCase = (from: string, to: string) =>
  from[0] === from[0].toUpperCase() && from[0] !== from[0].toLowerCase()
    ? to[0].toUpperCase() + to.slice(1)
    : to;

const LETTERS = "A-Za-zČŠŽĆĐčšžćđ";
const WORD = new RegExp(`[${LETTERS}]+`, "g");

/** One clause (no , . ! ? ; :) with its first-person plural forms made dual. */
function clauseToDual(clause: string) {
  const words = clause.match(WORD) ?? [];
  const lower = words.map((w) => w.toLowerCase());
  // "bi" (would) is ours too, unless the clause is about the guests:
  // "če bi prišli" (if you came), "ali bi lahko…" (could you…), "bi radi ostali"
  const aboutYou = lower.some((w) => YOU.has(w)) || ["če", "ali"].includes(lower[0]);
  const hasAux =
    lower.some((w) => AUX.has(w)) ||
    (lower.includes("bi") && !aboutYou && !lower.includes("lahko"));
  const withYou = /\bz vami\b/i.test(clause);
  let i = -1;
  return clause.replace(WORD, (w) => {
    i++;
    const l = w.toLowerCase();
    if (WORDS[l]) return keepCase(w, WORDS[l]);
    if (VERBS.includes(l) || (withYou && WITH_YOU.includes(l)))
      return keepCase(w, l.slice(0, -2) + "va");
    if (!hasAux) return w;
    // "poročili se bomo", "zelo smo veseli" → -la; "hvaležni smo" → -na
    const participle =
      l.length > 3 && l.endsWith("li") && !NOT_PARTICIPLE.has(l) && !PREPOSITIONS.has(lower[i - 1]);
    if (participle || ADJECTIVES.has(l)) return keepCase(w, l.slice(0, -1) + "a");
    return w;
  });
}

/** A text the couple wrote about themselves, translated to Slovenian, with dual forms. */
export function toSlovenianDual(text: string): string {
  return text
    .split(/([,.!?;:\n]+)/)
    .map((part, i) => (i % 2 ? part : clauseToDual(part)))
    .join("");
}
