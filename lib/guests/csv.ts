import { LOCALES } from "@/i18n/locales";
import type { AgeGroup, GuestList, GuestSide } from "@/lib/database.types";
import { fullName, type PartnerNames } from "./model";

// ---------------------------------------------------------------------------
// Import: spreadsheet columns → guest fields
// ---------------------------------------------------------------------------

/**
 * Every guest field a CSV column can be mapped to, with common header names
 * (English and the most common words in other languages). Labels are in
 * messages "guests.import.fields".
 */
export const IMPORT_FIELDS = [
  {
    key: "first_name",
    synonyms: [
      "first name",
      "firstname",
      "first",
      "given name",
      "forename",
      "name first",
      "ime",
      "nombre",
      "nome",
      "prénom",
      "prenom",
      "vorname",
      "voornaam",
      "imię",
      "jméno",
      "förnamn",
      "όνομα",
      "ad",
      "имя",
      "ім'я",
      "名",
      "이름",
      "nama depan",
      "tên",
      "ชื่อ",
    ],
  },
  {
    key: "last_name",
    synonyms: [
      "last name",
      "lastname",
      "last",
      "surname",
      "family name",
      "name last",
      "priimek",
      "prezime",
      "apellido",
      "apellidos",
      "sobrenome",
      "apelido",
      "cognome",
      "nom",
      "nom de famille",
      "nachname",
      "achternaam",
      "nazwisko",
      "příjmení",
      "efternamn",
      "επώνυμο",
      "soyad",
      "фамилия",
      "прізвище",
      "姓",
      "성",
      "nama belakang",
      "họ",
      "นามสกุล",
    ],
  },
  {
    key: "full_name",
    synonyms: [
      "full name",
      "name",
      "guest",
      "guest name",
      "fullname",
      "ime in priimek",
      "gost",
      "nombre completo",
      "invitado",
      "nome completo",
      "convidado",
      "ospite",
      "nom complet",
      "invité",
      "gast",
      "gość",
      "host",
      "gäst",
      "姓名",
      "名前",
      "tamu",
      "khách",
    ],
  },
  {
    key: "household",
    synonyms: [
      "household",
      "group",
      "family",
      "party",
      "invitation",
      "household name",
      "group name",
      "gospodinjstvo",
      "družina",
      "skupina",
      "obitelj",
      "familia",
      "grupo",
      "família",
      "famiglia",
      "gruppo",
      "famille",
      "groupe",
      "familie",
      "haushalt",
      "gruppe",
      "gezin",
      "groep",
      "rodzina",
      "grupa",
      "rodina",
      "skupina",
      "familj",
      "grupp",
      "οικογένεια",
      "aile",
      "семья",
      "сім'я",
      "家庭",
      "家族",
      "가족",
      "keluarga",
      "gia đình",
      "ครอบครัว",
    ],
  },
  {
    key: "email",
    synonyms: [
      "email",
      "e mail",
      "email address",
      "mail",
      "e pošta",
      "correo",
      "correo electrónico",
      "posta elettronica",
      "courriel",
      "e post",
      "e-mail",
      "邮箱",
      "メール",
      "이메일",
    ],
  },
  {
    key: "phone",
    synonyms: [
      "phone",
      "mobile",
      "phone number",
      "cell",
      "telephone",
      "tel",
      "telefon",
      "telefono",
      "teléfono",
      "telefone",
      "téléphone",
      "portable",
      "handy",
      "telefoon",
      "mobil",
      "gsm",
      "τηλέφωνο",
      "телефон",
      "电话",
      "電話",
      "전화",
      "telepon",
      "điện thoại",
      "โทรศัพท์",
    ],
  },
  {
    key: "side",
    synonyms: [
      "side",
      "bride or groom",
      "whose side",
      "guest of",
      "stran",
      "lado",
      "lato",
      "côté",
      "seite",
      "kant",
      "strona",
      "strana",
      "sida",
    ],
  },
  {
    key: "age_group",
    synonyms: [
      "age group",
      "age",
      "adult child",
      "type",
      "starost",
      "edad",
      "idade",
      "età",
      "âge",
      "alter",
      "leeftijd",
      "wiek",
      "věk",
      "ålder",
    ],
  },
  {
    key: "address_line1",
    synonyms: [
      "address",
      "address 1",
      "address line 1",
      "street",
      "street address",
      "naslov",
      "ulica",
      "adresa",
      "dirección",
      "calle",
      "endereço",
      "morada",
      "indirizzo",
      "via",
      "adresse",
      "rue",
      "straße",
      "strasse",
      "adres",
      "straat",
      "adress",
      "gata",
      "διεύθυνση",
      "адрес",
      "адреса",
      "地址",
      "住所",
      "주소",
      "alamat",
      "địa chỉ",
      "ที่อยู่",
    ],
  },
  {
    key: "address_line2",
    synonyms: ["address 2", "address line 2", "apt", "apartment", "suite"],
  },
  {
    key: "city",
    synonyms: [
      "city",
      "town",
      "mesto",
      "kraj",
      "grad",
      "ciudad",
      "cidade",
      "città",
      "ville",
      "stadt",
      "ort",
      "stad",
      "plaats",
      "miasto",
      "město",
      "πόλη",
      "şehir",
      "город",
      "місто",
      "城市",
      "市",
      "도시",
      "kota",
      "thành phố",
      "เมือง",
    ],
  },
  {
    key: "region",
    synonyms: [
      "state",
      "region",
      "province",
      "county",
      "regija",
      "provincia",
      "estado",
      "région",
      "bundesland",
      "provincie",
      "województwo",
      "kraj",
      "län",
    ],
  },
  {
    key: "postal_code",
    synonyms: [
      "zip",
      "zip code",
      "postal code",
      "postcode",
      "post code",
      "poštna številka",
      "pošta",
      "código postal",
      "cap",
      "code postal",
      "plz",
      "postleitzahl",
      "kod pocztowy",
      "psč",
      "postnummer",
      "邮编",
      "郵便番号",
      "우편번호",
      "kode pos",
    ],
  },
  {
    key: "country",
    synonyms: [
      "country",
      "država",
      "drzava",
      "país",
      "pais",
      "paese",
      "pays",
      "land",
      "kraj",
      "země",
      "χώρα",
      "ülke",
      "страна",
      "країна",
      "国家",
      "国",
      "국가",
      "negara",
      "quốc gia",
      "ประเทศ",
    ],
  },
  {
    key: "tags",
    synonyms: [
      "tags",
      "tag",
      "labels",
      "category",
      "relationship",
      "oznake",
      "etiquetas",
      "etichette",
      "étiquettes",
      "schlagwörter",
      "tagi",
      "štítky",
      "taggar",
    ],
  },
  {
    key: "events",
    synonyms: [
      "events",
      "event",
      "invited to",
      "invited events",
      "dogodki",
      "eventos",
      "eventi",
      "événements",
      "veranstaltungen",
      "evenementen",
      "wydarzenia",
      "události",
      "evenemang",
    ],
  },
  {
    key: "dietary",
    synonyms: [
      "dietary",
      "diet",
      "dietary restrictions",
      "allergies",
      "food",
      "prehrana",
      "alergije",
      "dieta",
      "alergias",
      "alimentação",
      "allergie",
      "régime",
      "ernährung",
      "allergien",
      "dieet",
      "strava",
      "kost",
    ],
  },
  {
    key: "accessibility",
    synonyms: [
      "accessibility",
      "access needs",
      "mobility",
      "dostopnost",
      "accesibilidad",
      "acessibilidade",
      "accessibilità",
      "accessibilité",
      "barrierefreiheit",
    ],
  },
  {
    key: "notes",
    synonyms: [
      "notes",
      "note",
      "comments",
      "comment",
      "opombe",
      "bilješke",
      "notas",
      "note",
      "remarques",
      "notizen",
      "bemerkungen",
      "notities",
      "uwagi",
      "poznámky",
      "anteckningar",
    ],
  },
  {
    key: "plus_one_allowed",
    synonyms: [
      "plus one",
      "plus one allowed",
      "plus 1",
      "guest allowed",
      "plusone",
      "spremljevalec",
      "acompañante",
      "acompanhante",
      "accompagnatore",
      "accompagnant",
      "begleitung",
      "partner",
    ],
  },
  {
    key: "plus_one_name",
    synonyms: ["plus one name", "plus 1 name", "guest of guest", "partner name"],
  },
  {
    key: "plus_one_of",
    synonyms: ["plus one of", "plus 1 of", "plusone of"],
  },
  {
    key: "list",
    synonyms: ["list", "a b list", "priority", "tier", "seznam", "lista", "liste", "lijst"],
  },
  {
    key: "language",
    synonyms: [
      "language",
      "lang",
      "preferred language",
      "jezik",
      "idioma",
      "língua",
      "lingua",
      "langue",
      "sprache",
      "taal",
      "język",
      "jazyk",
      "språk",
      "γλώσσα",
      "dil",
      "язык",
      "мова",
      "语言",
      "語言",
      "言語",
      "언어",
      "bahasa",
      "ngôn ngữ",
      "ภาษา",
    ],
  },
] as const;

export type ImportFieldKey = (typeof IMPORT_FIELDS)[number]["key"];
/** CSV header → field it fills (or "ignore"). */
export type ColumnMapping = Record<string, ImportFieldKey | "ignore">;

/** A guest ready to be imported (validated again on the server). */
export type ImportGuest = {
  firstName: string;
  lastName: string;
  household: string;
  email: string;
  phone: string;
  side: GuestSide;
  ageGroup: AgeGroup;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  tags: string[];
  events: string[];
  dietary: string;
  accessibility: string;
  notes: string;
  plusOneAllowed: boolean;
  plusOneName: string;
  /** full name of the guest who brings this person (rows exported by Vow) */
  plusOneOf: string;
  list: GuestList;
  /** the household's language code ("" = the couple's) */
  language: string;
};

// letters of any alphabet are kept (headers can be "Priimek", "Nom", "名前"…)
const simplify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}']+/gu, " ")
    .trim();

/** Guesses which field each CSV column holds, based on its header. */
export function guessMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<ImportFieldKey>();

  for (const header of headers) {
    const h = simplify(header);
    const match = IMPORT_FIELDS.find(
      (f) => !used.has(f.key) && (f.synonyms as readonly string[]).includes(h),
    );
    mapping[header] = match?.key ?? "ignore";
    if (match) used.add(match.key);
  }
  return mapping;
}

const TRUE_WORDS = ["yes", "y", "true", "1", "x", "allowed", "ja", "si", "sí", "oui"];

export function parseBool(value: string) {
  return TRUE_WORDS.includes(value.trim().toLowerCase());
}

/** Understands "Ian", "Ian's side", "bride", "groom", "A", "both", "mutual"… */
export function parseSide(value: string, names: PartnerNames): GuestSide {
  const v = simplify(value);
  if (!v) return "both";
  const a = simplify(names.a);
  const b = simplify(names.b);
  if (v === "a" || v === "partner a" || v === "1" || (a && v.startsWith(a))) return "partner_a";
  if (v === "b" || v === "partner b" || v === "2" || (b && v.startsWith(b))) return "partner_b";
  if (v.includes("bride")) return "partner_a";
  if (v.includes("groom")) return "partner_b";
  return "both";
}

export function parseAgeGroup(value: string): AgeGroup {
  const v = simplify(value);
  if (["infant", "baby", "toddler", "under 2"].some((w) => v.includes(w))) return "infant";
  if (["child", "kid", "minor", "teen"].some((w) => v.includes(w))) return "child";
  return "adult";
}

export function parseList(value: string): GuestList {
  const v = simplify(value);
  return v === "b" || v.startsWith("b list") || v.includes("wait") || v === "2" ? "b" : "a";
}

/** "sl", "Slovenian", "Slovenščina", "zh-TW"… → a language code ("" if unknown). */
export function parseLanguage(value: string) {
  const v = value.trim().toLowerCase();
  if (!v) return "";
  const hit = LOCALES.find(
    (l) =>
      l.code.toLowerCase() === v ||
      l.english.toLowerCase() === v ||
      l.native.toLowerCase() === v ||
      l.english.toLowerCase().split(" (")[0] === v,
  );
  if (hit) return hit.code;
  const base = LOCALES.find((l) => l.code === v.split(/[-_]/)[0]);
  return base?.code ?? "";
}

export function splitList(value: string) {
  return value
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** "Ann Marie Smith" → ["Ann Marie", "Smith"] */
export function splitFullName(name: string): [string, string] {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return [parts[0] ?? "", ""];
  return [parts.slice(0, -1).join(" "), parts[parts.length - 1]];
}

export type MapResult = {
  guests: ImportGuest[];
  /** 1-based spreadsheet row numbers (header = row 1) with a problem */
  errors: { row: number; problem: "noName" }[];
};

/** Turns parsed CSV rows into guests using the chosen mapping. */
export function mapRows(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  names: PartnerNames,
): MapResult {
  const guests: ImportGuest[] = [];
  const errors: MapResult["errors"] = [];

  rows.forEach((row, i) => {
    // Collect the value(s) of each mapped field for this row.
    const get = (key: ImportFieldKey) =>
      Object.entries(mapping)
        .filter(([, field]) => field === key)
        .map(([header]) => (row[header] ?? "").trim())
        .filter(Boolean)
        .join(" ");

    let firstName = get("first_name");
    let lastName = get("last_name");
    if (!firstName && !lastName && get("full_name")) {
      [firstName, lastName] = splitFullName(get("full_name"));
    }

    // Skip completely empty lines silently; flag rows without a name.
    const isEmpty = Object.values(row).every((v) => !String(v ?? "").trim());
    if (isEmpty) return;
    // An unnamed plus-one row is recreated from its host's "plus-one allowed".
    if (!firstName && !lastName && get("plus_one_of")) return;
    if (!firstName && !lastName) {
      errors.push({ row: i + 2, problem: "noName" });
      return;
    }

    const plusOneName = get("plus_one_name");
    guests.push({
      firstName,
      lastName,
      household: get("household") || fullName(firstName, lastName),
      email: get("email"),
      phone: get("phone"),
      side: parseSide(get("side"), names),
      ageGroup: parseAgeGroup(get("age_group")),
      addressLine1: get("address_line1"),
      addressLine2: get("address_line2"),
      city: get("city"),
      region: get("region"),
      postalCode: get("postal_code"),
      country: get("country"),
      tags: splitList(get("tags")),
      events: splitList(get("events")),
      dietary: get("dietary"),
      accessibility: get("accessibility"),
      notes: get("notes"),
      // a plus-one name implies a plus-one is allowed
      plusOneAllowed: parseBool(get("plus_one_allowed")) || !!plusOneName,
      plusOneName,
      plusOneOf: get("plus_one_of"),
      list: parseList(get("list")),
      language: parseLanguage(get("language")),
    });
  });

  return { guests, errors };
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/**
 * Spreadsheet apps run cells starting with = + - @ as formulas, which can be
 * abused ("CSV injection"). Prefixing an apostrophe makes them plain text.
 */
export function safeCell(value: string | null | undefined) {
  const v = value ?? "";
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}
