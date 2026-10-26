import type { BedConfig, HotelRoomRow, HotelRoomTypeRow, TagColor } from "../database.types";

/** How many people a bed sleeps. */
const BED_SPOTS: Record<BedConfig["kind"], number> = {
  double: 2,
  single: 1,
  sofa_bed: 2,
  bunk: 2,
};

/** People the beds can sleep, or null when no beds are filled in. */
export function bedSpots(beds: BedConfig[] | null | undefined): number | null {
  if (!beds?.length) return null;
  const total = beds.reduce((sum, b) => sum + (BED_SPOTS[b.kind] ?? 1) * b.count, 0);
  return total > 0 ? total : null;
}

/** Room's own capacity wins over its room type; untyped rooms are unlimited. */
export function roomCapacity(
  room: Pick<HotelRoomRow, "capacity">,
  type: Pick<HotelRoomTypeRow, "max_guests"> | null | undefined,
): number {
  return room.capacity ?? type?.max_guests ?? 99;
}

/** What a room is called on the board: its nickname, else its number. */
export function roomTitle(room: Pick<HotelRoomRow, "name" | "room_number">): string {
  return room.name?.trim() || room.room_number;
}

/**
 * `count` new room labels counting up from `start`, skipping ones in use.
 * "101" → 101, 102…  "Room A" → Room A, Room B…  "Cabin" → Cabin 1, Cabin 2…
 */
export function roomLabels(start: string, count: number, used: Iterable<string> = []): string[] {
  const taken = new Set(used);
  const base = start.trim() || "101";
  const num = base.match(/^(.*?)(\d+)$/);
  const letter = base.match(/^(.*?)([A-Za-z])$/);

  let make: (i: number) => string;
  if (num) {
    const [, prefix, digits] = num;
    const first = Number(digits);
    make = (i) => `${prefix}${String(first + i).padStart(digits.length, "0")}`;
  } else if (letter && (letter[1] === "" || /\s$/.test(letter[1]))) {
    const [, prefix, ch] = letter;
    const upper = ch === ch.toUpperCase();
    const first = ch.toUpperCase().charCodeAt(0) - 65;
    make = (i) => {
      let n = first + i;
      let s = "";
      do {
        s = String.fromCharCode(65 + (n % 26)) + s;
        n = Math.floor(n / 26) - 1;
      } while (n >= 0);
      return prefix + (upper ? s : s.toLowerCase());
    };
  } else {
    make = (i) => `${base} ${i + 1}`;
  }

  const out: string[] = [];
  for (let i = 0; out.length < count && i < count + 10_000; i++) {
    const label = make(i);
    if (!taken.has(label)) {
      out.push(label);
      taken.add(label);
    }
  }
  return out;
}

export type FriendGroup = { key: string; label: string; color: TagColor | null };

/** A guest's friend group: their first tag (by name), else their household. */
export function friendGroup(
  guest: { householdId: string; householdName: string; tagIds: string[] },
  tags: Map<string, { name: string; color: TagColor }>,
): FriendGroup {
  const own = guest.tagIds
    .map((id) => ({ id, tag: tags.get(id) }))
    .filter((x): x is { id: string; tag: { name: string; color: TagColor } } => !!x.tag)
    .sort((a, b) => a.tag.name.localeCompare(b.tag.name));
  if (own.length) return { key: `tag:${own[0].id}`, label: own[0].tag.name, color: own[0].tag.color };
  return { key: `hh:${guest.householdId}`, label: guest.householdName, color: null };
}

export type RsvpStatus = "attending" | "declined" | "not_replied";
export type RsvpFilter = "planning" | "attending" | "not_replied" | "everyone";

/** Default "planning" view: everyone who might come (attending + not replied). */
export function matchesRsvpFilter(status: RsvpStatus, filter: RsvpFilter): boolean {
  switch (filter) {
    case "planning":
      return status !== "declined";
    case "attending":
      return status === "attending";
    case "not_replied":
      return status === "not_replied";
    case "everyone":
      return true;
  }
}

/** Best RSVP across a guest's events: attending beats declined beats nothing. */
export function rsvpStatusOf(statuses: string[]): RsvpStatus {
  if (statuses.includes("attending")) return "attending";
  return statuses.length ? "declined" : "not_replied";
}
