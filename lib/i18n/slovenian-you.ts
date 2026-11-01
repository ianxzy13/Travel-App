// Translators speak to guests in the plural ("vi"). In Slovenian, one guest is
// "ti" and two are "vidva", so a machine-translated text of the couple's is
// changed to fit the household. Only clear forms are changed: pronouns
// (vas, vam, vaš…), "ste/boste" and a list of common verbs. A text that would
// need the guest's gender in the singular ("ste prišli" → "si prišel/prišla")
// stays in the plural, which is still correct (and polite) Slovenian.
import type { YouForm } from "@/i18n/you";

type Forms = [one: string, two: string];

const PRONOUNS: Record<string, Forms> = {
  vi: ["ti", "vidva"],
  vas: ["te", "vaju"],
  vam: ["ti", "vama"],
  vami: ["tabo", "vama"],
  ste: ["si", "sta"],
  boste: ["boš", "bosta"],
  niste: ["nisi", "nista"],
  vaš: ["tvoj", "vajin"],
  vaša: ["tvoja", "vajina"],
  vaše: ["tvoje", "vajine"],
  vaši: ["tvoji", "vajini"],
  vašo: ["tvojo", "vajino"],
  vašega: ["tvojega", "vajinega"],
  vašemu: ["tvojemu", "vajinemu"],
  vašem: ["tvojem", "vajinem"],
  vašim: ["tvojim", "vajinim"],
  vaših: ["tvojih", "vajinih"],
  vašima: ["tvojima", "vajinima"],
  vašimi: ["tvojimi", "vajinimi"],
};
// after a preposition the singular is the long form: "za vas" → "za tebe"
const AFTER_PREPOSITION: Record<string, string> = { vas: "tebe", vam: "tebi", vami: "tabo" };
const PREPOSITIONS = new Set([
  "za",
  "na",
  "v",
  "pred",
  "med",
  "nad",
  "pod",
  "skozi",
  "čez",
  "po",
  "o",
  "pri",
  "k",
  "h",
  "z",
  "s",
  "brez",
  "od",
  "do",
  "zaradi",
  "brez",
]);

// "you (all) …": present tense -te → -š / -ta
const PRESENT = new Set([
  "pridete",
  "morete",
  "želite",
  "imate",
  "nimate",
  "potrebujete",
  "ostanete",
  "pripeljete",
  "prinesete",
  "najdete",
  "vidite",
  "veselite",
  "znate",
  "hočete",
  "smete",
  "mislite",
  "praznujete",
  "plešete",
  "uživate",
  "spremljate",
  "pišete",
  "rezervirate",
]);
const PRESENT_ONE: Record<string, string> = {
  veste: "veš",
  greste: "greš",
  jeste: "ješ",
  daste: "daš",
};
// "do …!": imperative -te → (nothing) / -ta
const IMPERATIVE = new Set([
  "pridite",
  "sporočite",
  "potrdite",
  "odgovorite",
  "rezervirajte",
  "pišite",
  "pokličite",
  "prinesite",
  "pripeljite",
  "oblecite",
  "uživajte",
  "pridružite",
  "vzemite",
  "preverite",
  "javite",
  "obvestite",
  "glejte",
  "poglejte",
  "kliknite",
  "izberite",
  "izpolnite",
  "praznujte",
  "plešite",
  "spremljajte",
  "označite",
  "shranite",
  "pustite",
  "delite",
  "ostanite",
  "povejte",
  "dajte",
  "imejte",
  "bodite",
  "zapišite",
  "počakajte",
  "sledite",
]);
// "you are …" adjectives: two guests -i → -a ("vabljena"); one guest needs a gender
const ADJECTIVES = new Set([
  "dobrodošli",
  "vabljeni",
  "povabljeni",
  "veseli",
  "srečni",
  "pripravljeni",
]);
// "-li" words that are not participles ("ste prišli")
const NOT_PARTICIPLE = new Set([
  "ali",
  "koli",
  "kjerkoli",
  "kadarkoli",
  "karkoli",
  "kdorkoli",
  "doli",
  "boli",
  "zgoli",
  "mali",
  "sami",
  "naši",
  "vaši",
  "tvoji",
  "najini",
  "vajini",
  "tvoji",
  "bili",
]);
const YOU_AUX = new Set(["ste", "boste", "niste", "bi"]);
const isParticiple = (w: string) => w.length > 3 && w.endsWith("li") && !NOT_PARTICIPLE.has(w);

const LETTERS = "A-Za-zČŠŽĆĐčšžćđ";
const WORD = new RegExp(`[${LETTERS}]+`, "g");

const keepCase = (from: string, to: string) =>
  from[0] !== from[0].toLowerCase() ? to[0].toUpperCase() + to.slice(1) : to;

/** True if the singular would need the guest's gender ("ste prišli", "dobrodošli"). */
function needsGender(text: string) {
  return text.split(/[,.!?;:\n]+/).some((clause) => {
    const words = (clause.match(WORD) ?? []).map((w) => w.toLowerCase());
    if (words.some((w) => w === "dobrodošli" || w === "vabljeni" || w === "povabljeni"))
      return true;
    return (
      words.some((w) => YOU_AUX.has(w)) &&
      words.some((w) => w in PRONOUNS) &&
      words.some((w) => isParticiple(w) || ADJECTIVES.has(w))
    );
  });
}

/** A Slovenian text spoken to guests ("vi"), made fit for one guest ("ti") or two ("vidva"). */
export function toSlovenianYou(text: string, form: YouForm): string {
  if (form === "other") return text;
  const one = form === "one";
  if (one && needsGender(text)) return text;
  return text
    .split(/([,.!?;:\n]+)/)
    .map((clause, n) => {
      if (n % 2) return clause;
      const words = clause.match(WORD) ?? [];
      const lower = words.map((w) => w.toLowerCase());
      const aboutYou = lower.some((w) => w in PRONOUNS);
      let i = -1;
      let out = clause.replace(WORD, (w) => {
        i++;
        const l = w.toLowerCase();
        const prev = lower[i - 1];
        if (l in PRONOUNS) {
          if (one && prev && PREPOSITIONS.has(prev) && AFTER_PREPOSITION[l])
            return AFTER_PREPOSITION[l];
          const to = PRONOUNS[l][one ? 0 : 1];
          return i > 0 ? to : keepCase(w, to);
        }
        if (IMPERATIVE.has(l)) return keepCase(w, l.slice(0, -2) + (one ? "" : "ta"));
        if (PRESENT_ONE[l] || (PRESENT.has(l) && l.endsWith("te"))) {
          if (!one) return keepCase(w, l.slice(0, -2) + "ta");
          return keepCase(w, PRESENT_ONE[l] ?? l.slice(0, -2) + "š");
        }
        // two guests: "ste prišli" → "sta prišla"
        if (!one && (ADJECTIVES.has(l) || (aboutYou && isParticiple(l))))
          return keepCase(w, l.slice(0, -1) + "a");
        return w;
      });
      // "z/s" before the new word: "z vami" → "s tabo"
      if (one) out = out.replace(/\b([zZ]) (tabo)\b/g, (_, z) => (z === "Z" ? "S" : "s") + " tabo");
      return out;
    })
    .join("");
}
