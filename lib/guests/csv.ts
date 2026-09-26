import type { AgeGroup, GuestList, GuestSide } from "@/lib/database.types";
import { fullName, type PartnerNames } from "./model";

// ---------------------------------------------------------------------------
// Import: spreadsheet columns → guest fields
// ---------------------------------------------------------------------------

/** Every guest field a CSV column can be mapped to, with common header names. */
export const IMPORT_FIELDS = [
  {
    key: "first_name",
    label: "First name",
    synonyms: ["first name", "firstname", "first", "given name", "forename", "name first"],
  },
  {
    key: "last_name",
    label: "Last name",
    synonyms: ["last name", "lastname", "last", "surname", "family name", "name last"],
  },
  {
    key: "full_name",
    label: "Full name",
    synonyms: ["full name", "name", "guest", "guest name", "fullname"],
  },
  {
    key: "household",
    label: "Household / group",
    synonyms: [
      "household",
      "group",
      "family",
      "party",
      "invitation",
      "household name",
      "group name",
    ],
  },
  { key: "email", label: "Email", synonyms: ["email", "e mail", "email address", "mail"] },
  {
    key: "phone",
    label: "Phone",
    synonyms: ["phone", "mobile", "phone number", "cell", "telephone", "tel"],
  },
  { key: "side", label: "Side", synonyms: ["side", "bride or groom", "whose side", "guest of"] },
  { key: "age_group", label: "Age group", synonyms: ["age group", "age", "adult child", "type"] },
  {
    key: "address_line1",
    label: "Address line 1",
    synonyms: ["address", "address 1", "address line 1", "street", "street address"],
  },
  {
    key: "address_line2",
    label: "Address line 2",
    synonyms: ["address 2", "address line 2", "apt", "apartment", "suite"],
  },
  { key: "city", label: "City", synonyms: ["city", "town"] },
  { key: "region", label: "State / region", synonyms: ["state", "region", "province", "county"] },
  {
    key: "postal_code",
    label: "Postal code",
    synonyms: ["zip", "zip code", "postal code", "postcode", "post code"],
  },
  { key: "country", label: "Country", synonyms: ["country"] },
  {
    key: "tags",
    label: "Tags (comma separated)",
    synonyms: ["tags", "tag", "labels", "category", "relationship"],
  },
  {
    key: "events",
    label: "Events (comma separated)",
    synonyms: ["events", "event", "invited to", "invited events"],
  },
  {
    key: "dietary",
    label: "Dietary restrictions",
    synonyms: ["dietary", "diet", "dietary restrictions", "allergies", "food"],
  },
  {
    key: "accessibility",
    label: "Accessibility needs",
    synonyms: ["accessibility", "access needs", "mobility"],
  },
  { key: "notes", label: "Notes", synonyms: ["notes", "note", "comments", "comment"] },
  {
    key: "plus_one_allowed",
    label: "Plus-one allowed",
    synonyms: ["plus one", "plus one allowed", "plus 1", "guest allowed", "plusone"],
  },
  {
    key: "plus_one_name",
    label: "Plus-one name",
    synonyms: ["plus one name", "plus 1 name", "guest of guest", "partner name"],
  },
  {
    key: "plus_one_of",
    label: "Plus-one of (host's full name)",
    synonyms: ["plus one of", "plus 1 of", "plusone of"],
  },
  { key: "list", label: "A / B list", synonyms: ["list", "a b list", "priority", "tier"] },
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
};

const simplify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
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
  errors: { row: number; message: string }[];
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
      errors.push({ row: i + 2, message: "No name, row skipped" });
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
