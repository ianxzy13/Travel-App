import type {
  AgeGroup,
  GuestEventInviteRow,
  GuestList,
  GuestRow,
  GuestSide,
  GuestTagRow,
  HouseholdRow,
  RsvpStatus,
} from "@/lib/database.types";

/** A guest with everything the guest list screen needs, flattened. */
export type GuestView = {
  id: string;
  householdId: string;
  householdName: string;
  /** the household's language ("" = the couple's language) */
  householdLanguage: string;
  firstName: string;
  lastName: string;
  /** "Ann Smith", or "Ann's guest" for an unnamed plus-one */
  name: string;
  email: string | null;
  phone: string | null;
  side: GuestSide;
  ageGroup: AgeGroup;
  plusOneAllowed: boolean;
  /** id of the guest who brings this plus-one (null for regular guests) */
  plusOneOf: string | null;
  dietary: string | null;
  accessibility: string | null;
  notes: string | null;
  languages: string[];
  list: GuestList;
  tagIds: string[];
  eventIds: string[];
  /** event id → RSVP answer (missing = no reply yet) */
  rsvp: Record<string, RsvpStatus>;
};

export type PartnerNames = { a: string; b: string };

/** Words used in guest names, in the viewer's language (see messages "guests"). */
export type NameLabels = { guestOf: (host: string) => string; unnamed: string };
const EN_LABELS: NameLabels = { guestOf: (h) => `${h}'s guest`, unnamed: "Unnamed guest" };

/** "Ian's side" / "Both", given the translated words. */
export function sideLabel(
  side: GuestSide,
  names: PartnerNames,
  t: (key: "sideOf" | "both", values?: { name: string }) => string,
) {
  if (side === "partner_a") return t("sideOf", { name: names.a });
  if (side === "partner_b") return t("sideOf", { name: names.b });
  return t("both");
}

export const AGE_GROUPS: AgeGroup[] = ["adult", "child", "infant"];

export function fullName(first: string, last: string) {
  return `${first} ${last}`.trim();
}

/** Display name; unnamed plus-ones become "Ann's guest". */
export function guestDisplayName(
  g: Pick<GuestRow, "first_name" | "last_name">,
  hostFirstName?: string | null,
  labels: NameLabels = EN_LABELS,
) {
  const name = fullName(g.first_name, g.last_name);
  if (name) return name;
  return hostFirstName ? labels.guestOf(hostFirstName) : labels.unnamed;
}

/** Joins the raw database rows into GuestView objects. */
export function buildGuestViews(data: {
  guests: GuestRow[];
  households: Pick<HouseholdRow, "id" | "name" | "preferred_language">[];
  invites: Pick<GuestEventInviteRow, "guest_id" | "event_id">[];
  guestTags: Pick<GuestTagRow, "guest_id" | "tag_id">[];
  responses?: { guest_id: string; event_id: string; status: RsvpStatus }[];
  labels?: NameLabels;
}): GuestView[] {
  const householdNames = new Map(data.households.map((h) => [h.id, h.name]));
  const householdLanguages = new Map(
    data.households.map((h) => [h.id, h.preferred_language ?? ""]),
  );
  const firstNames = new Map(data.guests.map((g) => [g.id, g.first_name]));
  const eventsByGuest = groupIds(data.invites, "guest_id", "event_id");
  const tagsByGuest = groupIds(data.guestTags, "guest_id", "tag_id");
  const rsvpByGuest = new Map<string, Record<string, RsvpStatus>>();
  for (const r of data.responses ?? []) {
    rsvpByGuest.set(r.guest_id, { ...rsvpByGuest.get(r.guest_id), [r.event_id]: r.status });
  }

  return data.guests.map((g) => ({
    id: g.id,
    householdId: g.household_id,
    householdName: householdNames.get(g.household_id) ?? "",
    householdLanguage: householdLanguages.get(g.household_id) ?? "",
    firstName: g.first_name,
    lastName: g.last_name,
    name: guestDisplayName(g, g.plus_one_of ? firstNames.get(g.plus_one_of) : null, data.labels),
    email: g.email,
    phone: g.phone,
    side: g.side,
    ageGroup: g.age_group,
    plusOneAllowed: g.plus_one_allowed,
    plusOneOf: g.plus_one_of,
    dietary: g.dietary,
    accessibility: g.accessibility,
    notes: g.notes,
    list: g.list,
    languages: g.languages ?? [],
    tagIds: tagsByGuest.get(g.id) ?? [],
    eventIds: eventsByGuest.get(g.id) ?? [],
    rsvp: rsvpByGuest.get(g.id) ?? {},
  }));
}

function groupIds<T, K extends keyof T, V extends keyof T>(rows: T[], key: K, value: V) {
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const k = row[key] as string;
    const list = map.get(k) ?? [];
    list.push(row[value] as string);
    map.set(k, list);
  }
  return map;
}
