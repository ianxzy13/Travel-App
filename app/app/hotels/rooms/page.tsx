import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { RoomBoard } from "@/components/hotels/room-board";
import { loadPickerGuests } from "@/lib/guests/picker";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { canEdit, requireWedding } from "@/lib/wedding";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("hotels"))("board.title") };
}

export default async function HotelRooms() {
  const { wedding, role } = await requireWedding();
  const sb = await createClient();
  const [hotels, roomTypes, rooms, roomAssignments, pickerGuests, relationships] = await Promise.all([
    fetchAll((f, t) =>
      sb
        .from("hotels")
        .select("id, name, price_per_night")
        .eq("wedding_id", wedding.id)
        .order("created_at")
        .range(f, t),
    ),
    fetchAll((f, t) =>
      sb
        .from("hotel_room_types")
        .select("*")
        .eq("wedding_id", wedding.id)
        .order("sort_order")
        .range(f, t),
    ),
    fetchAll((f, t) =>
      sb
        .from("hotel_rooms")
        .select("*")
        .eq("wedding_id", wedding.id)
        .order("sort_order")
        .range(f, t),
    ),
    fetchAll((f, t) =>
      sb
        .from("hotel_room_assignments")
        .select("*")
        .eq("wedding_id", wedding.id)
        .order("id")
        .range(f, t),
    ),
    loadPickerGuests(sb, wedding.id),
    fetchAll((f, t) =>
      sb
        .from("guest_relationships")
        .select("guest_a, guest_b, type")
        .eq("wedding_id", wedding.id)
        .range(f, t),
    ),
  ]);

  const guestRows = await fetchAll((f, t) =>
    sb
      .from("guests")
      .select("id, age_group, household_id, accessibility, wants_hotel_room")
      .eq("wedding_id", wedding.id)
      .order("id")
      .range(f, t),
  );
  const guestExtra = new Map(guestRows.map((g) => [g.id, g]));

  const boardGuests = pickerGuests.map((pg) => {
    const extra = guestExtra.get(pg.id);
    return {
      ...pg,
      ageGroup: extra?.age_group ?? "adult",
      householdId: extra?.household_id ?? pg.householdId,
      accessibility: extra?.accessibility ?? null,
      wantsRoom: extra?.wants_hotel_room ?? null,
    };
  });

  return (
    <div className="flex flex-col gap-4 p-4 md:h-[calc(100vh-4rem)]">
      <RoomBoard
        hotels={hotels.map((h) => ({
          ...h,
          price_per_night: h.price_per_night == null ? null : Number(h.price_per_night),
        }))}
        roomTypes={roomTypes.map((rt) => ({
          ...rt,
          price_per_night: rt.price_per_night == null ? null : Number(rt.price_per_night),
        }))}
        rooms={rooms}
        roomAssignments={roomAssignments}
        guests={boardGuests}
        relationships={relationships.map((r) => ({
          guestA: r.guest_a,
          guestB: r.guest_b,
          type: r.type,
        }))}
        currency={wedding.currency}
        canEdit={canEdit(role)}
      />
    </div>
  );
}
