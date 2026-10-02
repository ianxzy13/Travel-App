import type { HotelRoomAssignmentRow, HotelRoomRow, HotelRoomTypeRow } from "../database.types";

export type RoomWarning = {
  roomId: string;
  kind: WarningKind;
  message: string;
  guestIds?: string[];
};

export type WarningKind =
  | "over_capacity"
  | "child_alone"
  | "keep_apart"
  | "night_mismatch"
  | "empty_room"
  | "no_room"
  | "stranger_pair";

type RoomGuest = {
  id: string;
  name: string;
  householdId: string;
  ageGroup: string;
  accessibility: string | null;
};

type Relationship = {
  guestA: string;
  guestB: string;
  type: "keep_together" | "keep_apart";
};

export type RuleInput = {
  rooms: HotelRoomRow[];
  roomTypes: Map<string, HotelRoomTypeRow>;
  assignments: HotelRoomAssignmentRow[];
  guests: Map<string, RoomGuest>;
  relationships: Relationship[];
  attendingGuestIds: Set<string>;
};

export function checkRoomRules(input: RuleInput): RoomWarning[] {
  const warnings: RoomWarning[] = [];
  const { rooms, roomTypes, assignments, guests, relationships, attendingGuestIds } = input;

  const assignmentsByRoom = new Map<string, HotelRoomAssignmentRow[]>();
  for (const a of assignments) {
    const list = assignmentsByRoom.get(a.room_id) ?? [];
    list.push(a);
    assignmentsByRoom.set(a.room_id, list);
  }

  const assignedGuestIds = new Set(assignments.map((a) => a.guest_id));

  for (const room of rooms) {
    const ra = assignmentsByRoom.get(room.id) ?? [];
    const rt = room.room_type_id ? roomTypes.get(room.room_type_id) : null;
    const maxGuests = rt?.max_guests ?? 99;

    // Over capacity
    if (ra.length > maxGuests) {
      warnings.push({
        roomId: room.id,
        kind: "over_capacity",
        message: `Room ${room.room_number} has ${ra.length} guests but only fits ${maxGuests}.`,
        guestIds: ra.map((a) => a.guest_id),
      });
    }

    // Child without guardian
    const roomGuests = ra.map((a) => guests.get(a.guest_id)).filter(Boolean) as RoomGuest[];
    const children = roomGuests.filter(
      (g) => g.ageGroup === "child" || g.ageGroup === "infant",
    );
    const adults = roomGuests.filter((g) => g.ageGroup === "adult");
    if (children.length > 0 && adults.length === 0) {
      warnings.push({
        roomId: room.id,
        kind: "child_alone",
        message: `Room ${room.room_number} has children but no adults.`,
        guestIds: children.map((c) => c.id),
      });
    }

    // Keep-apart violations
    for (const rel of relationships) {
      if (rel.type !== "keep_apart") continue;
      const aInRoom = ra.some((a) => a.guest_id === rel.guestA);
      const bInRoom = ra.some((a) => a.guest_id === rel.guestB);
      if (aInRoom && bInRoom) {
        const nameA = guests.get(rel.guestA)?.name ?? "?";
        const nameB = guests.get(rel.guestB)?.name ?? "?";
        warnings.push({
          roomId: room.id,
          kind: "keep_apart",
          message: `${nameA} and ${nameB} should be kept apart but share room ${room.room_number}.`,
          guestIds: [rel.guestA, rel.guestB],
        });
      }
    }

    // Night mismatch
    const dates = ra.filter((a) => a.check_in || a.check_out);
    if (dates.length > 1) {
      const checkIns = new Set(dates.map((a) => a.check_in).filter(Boolean));
      const checkOuts = new Set(dates.map((a) => a.check_out).filter(Boolean));
      if (checkIns.size > 1 || checkOuts.size > 1) {
        warnings.push({
          roomId: room.id,
          kind: "night_mismatch",
          message: `Roommates in ${room.room_number} have different check-in/check-out dates.`,
          guestIds: dates.map((a) => a.guest_id),
        });
      }
    }

    // Empty room (has a type but nobody assigned)
    if (ra.length === 0 && rt) {
      warnings.push({
        roomId: room.id,
        kind: "empty_room",
        message: `Room ${room.room_number} is empty.`,
      });
    }

    // Strangers paired: guests from different households, none are couples/family
    if (ra.length >= 2) {
      const households = new Set(roomGuests.map((g) => g.householdId));
      if (households.size > 1) {
        const keepTogetherPairs = new Set(
          relationships
            .filter((r) => r.type === "keep_together")
            .map((r) => `${r.guestA}:${r.guestB}`),
        );
        const allConnected = roomGuests.every((g, i) =>
          roomGuests.some(
            (other, j) =>
              i === j ||
              g.householdId === other.householdId ||
              keepTogetherPairs.has(`${g.id}:${other.id}`) ||
              keepTogetherPairs.has(`${other.id}:${g.id}`),
          ),
        );
        if (!allConnected) {
          warnings.push({
            roomId: room.id,
            kind: "stranger_pair",
            message: `Room ${room.room_number} has guests from different households who aren't connected.`,
            guestIds: roomGuests.map((g) => g.id),
          });
        }
      }
    }
  }

  // Guests without a room
  for (const guestId of attendingGuestIds) {
    if (!assignedGuestIds.has(guestId)) {
      const g = guests.get(guestId);
      warnings.push({
        roomId: "",
        kind: "no_room",
        message: `${g?.name ?? "A guest"} has no room assigned.`,
        guestIds: [guestId],
      });
    }
  }

  return warnings;
}

export function warningCountByRoom(warnings: RoomWarning[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const w of warnings) {
    if (w.roomId) counts.set(w.roomId, (counts.get(w.roomId) ?? 0) + 1);
  }
  return counts;
}
