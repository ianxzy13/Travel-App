import type { AgeGroup, GuestList, GuestSide } from "@/lib/database.types";
import type { GuestView } from "./model";

export type GuestFilters = {
  search: string;
  side: GuestSide | "all";
  householdId: string; // "all" or a household id
  eventId: string; // "all", "none" (not invited to anything) or an event id
  tagId: string; // "all" or a tag id
  ageGroup: AgeGroup | "all";
  list: GuestList | "all";
};

export const DEFAULT_FILTERS: GuestFilters = {
  search: "",
  side: "all",
  householdId: "all",
  eventId: "all",
  tagId: "all",
  ageGroup: "all",
  list: "all",
};

/** How many filters (besides search) are active, for the "Filters (2)" badge. */
export function activeFilterCount(f: GuestFilters) {
  return (["side", "householdId", "eventId", "tagId", "ageGroup", "list"] as const).filter(
    (k) => f[k] !== "all",
  ).length;
}

/** Lower-case and strip accents so "José" matches "jose". */
export function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export function filterGuests(guests: GuestView[], f: GuestFilters): GuestView[] {
  const words = normalize(f.search).split(/\s+/).filter(Boolean);

  return guests.filter((g) => {
    if (f.side !== "all" && g.side !== f.side) return false;
    if (f.householdId !== "all" && g.householdId !== f.householdId) return false;
    if (f.ageGroup !== "all" && g.ageGroup !== f.ageGroup) return false;
    if (f.list !== "all" && g.list !== f.list) return false;
    if (f.tagId !== "all" && !g.tagIds.includes(f.tagId)) return false;
    if (f.eventId === "none" && g.eventIds.length > 0) return false;
    if (f.eventId !== "all" && f.eventId !== "none" && !g.eventIds.includes(f.eventId)) {
      return false;
    }
    if (words.length) {
      // every search word must appear somewhere in the guest's details
      const haystack = normalize([g.name, g.householdName, g.email ?? "", g.phone ?? ""].join(" "));
      if (!words.every((w) => haystack.includes(w))) return false;
    }
    return true;
  });
}

export type SortKey = "name" | "household" | "side" | "age" | "list";
export type SortState = { key: SortKey; dir: "asc" | "desc" };

const AGE_ORDER = { adult: 0, child: 1, infant: 2 };
const SIDE_ORDER = { partner_a: 0, partner_b: 1, both: 2 };
const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

function compareBy(key: SortKey, a: GuestView, b: GuestView) {
  switch (key) {
    case "name":
      // last name first, like a printed guest list; unnamed plus-ones sort by display name
      return (
        collator.compare(a.lastName || a.name, b.lastName || b.name) ||
        collator.compare(a.firstName, b.firstName)
      );
    case "household":
      return collator.compare(a.householdName, b.householdName);
    case "side":
      return SIDE_ORDER[a.side] - SIDE_ORDER[b.side];
    case "age":
      return AGE_ORDER[a.ageGroup] - AGE_ORDER[b.ageGroup];
    case "list":
      return a.list.localeCompare(b.list);
  }
}

/** Returns a new sorted array; ties fall back to name so the order is stable. */
export function sortGuests(guests: GuestView[], sort: SortState): GuestView[] {
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...guests].sort((a, b) => sign * compareBy(sort.key, a, b) || compareBy("name", a, b));
}

/**
 * Orders guests so each household's members sit together (households sorted by
 * name) and every plus-one comes right after the guest who brings them.
 */
export function groupByHousehold(guests: GuestView[]) {
  const groups = new Map<string, { id: string; name: string; guests: GuestView[] }>();
  for (const g of guests) {
    const group = groups.get(g.householdId) ?? {
      id: g.householdId,
      name: g.householdName,
      guests: [],
    };
    group.guests.push(g);
    groups.set(g.householdId, group);
  }
  for (const group of groups.values()) group.guests = plusOnesAfterHosts(group.guests);
  return [...groups.values()].sort((a, b) => collator.compare(a.name, b.name));
}

function plusOnesAfterHosts(guests: GuestView[]) {
  const ids = new Set(guests.map((g) => g.id));
  // plus-ones whose host is also in this list get placed next to that host
  const attached = guests.filter((g) => g.plusOneOf && ids.has(g.plusOneOf));
  const result: GuestView[] = [];
  for (const g of guests) {
    if (attached.includes(g)) continue;
    result.push(g, ...attached.filter((p) => p.plusOneOf === g.id));
  }
  return result;
}
