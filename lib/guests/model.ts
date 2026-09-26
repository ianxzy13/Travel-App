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
  list: GuestList;
  tagIds: string[];
  eventIds: string[];
  /** event id → RSVP answer (missing = no reply yet) */
  rsvp: Record<string, RsvpStatus>;
};

export type PartnerNames = { a: string; b: string };

export const AGE_GROUP_LABELS: Record<AgeGroup, string> = {
  adult: "Adult",
  child: "Child",
  infant: "Infant",
};

export function sideLabel(side: GuestSide, names: PartnerNames) {
  if (side === "partner_a") return `${names.a}'s side`;
  if (side === "partner_b") return `${names.b}'s side`;
  return "Both";
}

export function fullName(first: string, last: string) {
  return `${first} ${last}`.trim();
}

/** Display name; unnamed plus-ones become "Ann's guest". */
export function guestDisplayName(
  g: Pick<GuestRow, "first_name" | "last_name">,
  hostFirstName?: string | null,
) {
  const name = fullName(g.first_name, g.last_name);
  if (name) return name;
  return hostFirstName ? `${hostFirstName}'s guest` : "Unnamed guest";
}

/** Joins the raw database rows into GuestView objects. */
export function buildGuestViews(data: {
  guests: GuestRow[];
  households: Pick<HouseholdRow, "id" | "name">[];
  invites: Pick<GuestEventInviteRow, "guest_id" | "event_id">[];
  guestTags: Pick<GuestTagRow, "guest_id" | "tag_id">[];
  responses?: { guest_id: string; event_id: string; status: RsvpStatus }[];
}): GuestView[] {
  const householdNames = new Map(data.households.map((h) => [h.id, h.name]));
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
    firstName: g.first_name,
    lastName: g.last_name,
    name: guestDisplayName(g, g.plus_one_of ? firstNames.get(g.plus_one_of) : null),
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
