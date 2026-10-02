import type { HotelRoomAssignmentRow, HotelRoomRow, HotelRoomTypeRow, HotelRow } from "../database.types";

type HotelItem = Pick<HotelRow, "id" | "name" | "price_per_night">;
type RoomTypeItem = Pick<HotelRoomTypeRow, "id" | "price_per_night" | "max_guests">;

export type RoomCostSummary = {
  totalPerNight: number;
  totalRooms: number;
  occupiedRooms: number;
  totalGuests: number;
  byHotel: {
    hotelId: string;
    hotelName: string;
    rooms: number;
    occupiedRooms: number;
    guests: number;
    costPerNight: number;
  }[];
};

export function computeRoomCosts({
  hotels,
  rooms,
  roomTypes,
  assignments,
}: {
  hotels: HotelItem[];
  rooms: HotelRoomRow[];
  roomTypes: Map<string, RoomTypeItem>;
  assignments: HotelRoomAssignmentRow[];
}): RoomCostSummary {
  const assignmentsByRoom = new Map<string, number>();
  for (const a of assignments) {
    assignmentsByRoom.set(a.room_id, (assignmentsByRoom.get(a.room_id) ?? 0) + 1);
  }

  let totalPerNight = 0;
  let totalRooms = 0;
  let occupiedRooms = 0;
  let totalGuests = 0;

  const byHotel: RoomCostSummary["byHotel"] = [];

  for (const hotel of hotels) {
    const hotelRooms = rooms.filter((r) => r.hotel_id === hotel.id);
    let hCost = 0;
    let hOccupied = 0;
    let hGuests = 0;

    for (const room of hotelRooms) {
      const guestCount = assignmentsByRoom.get(room.id) ?? 0;
      if (guestCount > 0) hOccupied++;
      hGuests += guestCount;

      const rt = room.room_type_id ? roomTypes.get(room.room_type_id) : null;
      const price = rt?.price_per_night ?? (hotel as { price_per_night?: number | null }).price_per_night ?? 0;
      if (guestCount > 0) hCost += Number(price);
    }

    totalPerNight += hCost;
    totalRooms += hotelRooms.length;
    occupiedRooms += hOccupied;
    totalGuests += hGuests;

    byHotel.push({
      hotelId: hotel.id,
      hotelName: hotel.name,
      rooms: hotelRooms.length,
      occupiedRooms: hOccupied,
      guests: hGuests,
      costPerNight: hCost,
    });
  }

  return { totalPerNight, totalRooms, occupiedRooms, totalGuests, byHotel };
}
