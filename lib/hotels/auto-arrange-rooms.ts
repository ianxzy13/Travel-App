import type { HotelRoomRow, HotelRoomTypeRow, HotelRoomAssignmentRow } from "../database.types";

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

export type AutoArrangeResult = {
  assignments: { roomId: string; guestId: string }[];
  placed: string[];
  unplaced: string[];
};

export function autoArrangeRooms({
  rooms,
  roomTypes,
  existingAssignments,
  guests,
  relationships,
}: {
  rooms: HotelRoomRow[];
  roomTypes: Map<string, HotelRoomTypeRow>;
  existingAssignments: HotelRoomAssignmentRow[];
  guests: RoomGuest[];
  relationships: Relationship[];
}): AutoArrangeResult {
  const lockedRoomIds = new Set(rooms.filter((r) => r.is_locked).map((r) => r.id));
  const assignedGuestIds = new Set(existingAssignments.map((a) => a.guest_id));

  const roomOccupancy = new Map<string, Set<string>>();
  for (const r of rooms) roomOccupancy.set(r.id, new Set());
  for (const a of existingAssignments) {
    roomOccupancy.get(a.room_id)?.add(a.guest_id);
  }

  const unassigned = guests.filter((g) => !assignedGuestIds.has(g.id));

  // Build units (groups that should be together) using union-find
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    if (!parent.has(x)) parent.set(x, x);
    if (parent.get(x) !== x) parent.set(x, find(parent.get(x)!));
    return parent.get(x)!;
  };
  const union = (a: string, b: string) => {
    parent.set(find(a), find(b));
  };

  // Same household → same unit
  const guestMap = new Map(guests.map((g) => [g.id, g]));
  const byHousehold = new Map<string, string[]>();
  for (const g of unassigned) {
    const list = byHousehold.get(g.householdId) ?? [];
    list.push(g.id);
    byHousehold.set(g.householdId, list);
  }
  for (const members of byHousehold.values()) {
    for (let i = 1; i < members.length; i++) union(members[0], members[i]);
  }

  // Keep-together → same unit
  for (const rel of relationships) {
    if (rel.type === "keep_together") {
      const aUnassigned = !assignedGuestIds.has(rel.guestA);
      const bUnassigned = !assignedGuestIds.has(rel.guestB);
      if (aUnassigned && bUnassigned) union(rel.guestA, rel.guestB);
    }
  }

  // Group unassigned guests into units
  const unitMap = new Map<string, string[]>();
  for (const g of unassigned) {
    const root = find(g.id);
    const list = unitMap.get(root) ?? [];
    list.push(g.id);
    unitMap.set(root, list);
  }
  // Sort largest units first
  const units = [...unitMap.values()].sort((a, b) => b.length - a.length);

  // Keep-apart lookup
  const keepApart = new Set<string>();
  for (const rel of relationships) {
    if (rel.type === "keep_apart") {
      keepApart.add(`${rel.guestA}:${rel.guestB}`);
      keepApart.add(`${rel.guestB}:${rel.guestA}`);
    }
  }

  const result: { roomId: string; guestId: string }[] = [];
  const placed: string[] = [];
  const unplaced: string[] = [];

  const freeSpots = (roomId: string) => {
    const r = rooms.find((rm) => rm.id === roomId);
    const rt = r?.room_type_id ? roomTypes.get(r.room_type_id) : null;
    const max = rt?.max_guests ?? 99;
    return max - (roomOccupancy.get(roomId)?.size ?? 0);
  };

  const hasKeepApart = (roomId: string, guestId: string): boolean => {
    const occ = roomOccupancy.get(roomId);
    if (!occ) return false;
    for (const existing of occ) {
      if (keepApart.has(`${guestId}:${existing}`)) return true;
    }
    return false;
  };

  const scoreRoom = (roomId: string, unit: string[]): number => {
    const free = freeSpots(roomId);
    if (free < unit.length) return -Infinity;
    for (const gid of unit) {
      if (hasKeepApart(roomId, gid)) return -Infinity;
    }

    let score = 0;
    const occ = roomOccupancy.get(roomId) ?? new Set();

    // Prefer rooms with same household already there
    for (const gid of unit) {
      const g = guestMap.get(gid);
      if (!g) continue;
      for (const existing of occ) {
        const eg = guestMap.get(existing);
        if (!eg) continue;
        if (eg.householdId === g.householdId) score += 10;
        if (eg.ageGroup === g.ageGroup) score += 1;
      }
    }

    // Prefer tightest fit
    score += (unit.length / free) * 2;

    // Accessible guests prefer accessible rooms
    const r = rooms.find((rm) => rm.id === roomId);
    const rt = r?.room_type_id ? roomTypes.get(r.room_type_id) : null;
    if (unit.some((gid) => guestMap.get(gid)?.accessibility) && rt?.accessible) {
      score += 20;
    }

    // Children prefer rooms with adults from same household
    const hasChildren = unit.some((gid) => {
      const g = guestMap.get(gid);
      return g?.ageGroup === "child" || g?.ageGroup === "infant";
    });
    if (hasChildren) {
      for (const existing of occ) {
        const eg = guestMap.get(existing);
        if (eg?.ageGroup === "adult" && unit.some((gid) => guestMap.get(gid)?.householdId === eg.householdId)) {
          score += 15;
        }
      }
    }

    return score;
  };

  // Place each unit
  for (const unit of units) {
    const availableRooms = rooms
      .filter((r) => !lockedRoomIds.has(r.id))
      .map((r) => r.id);

    let bestRoom: string | null = null;
    let bestScore = -Infinity;

    for (const roomId of availableRooms) {
      const s = scoreRoom(roomId, unit);
      if (s > bestScore) {
        bestScore = s;
        bestRoom = roomId;
      }
    }

    if (bestRoom && bestScore > -Infinity) {
      for (const gid of unit) {
        result.push({ roomId: bestRoom, guestId: gid });
        roomOccupancy.get(bestRoom)?.add(gid);
        placed.push(gid);
      }
    } else {
      // Try placing individually
      for (const gid of unit) {
        let found = false;
        for (const roomId of availableRooms) {
          if (freeSpots(roomId) >= 1 && !hasKeepApart(roomId, gid)) {
            result.push({ roomId, guestId: gid });
            roomOccupancy.get(roomId)?.add(gid);
            placed.push(gid);
            found = true;
            break;
          }
        }
        if (!found) unplaced.push(gid);
      }
    }
  }

  return { assignments: result, placed, unplaced };
}
