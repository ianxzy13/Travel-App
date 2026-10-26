import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { RoomBoard } from "@/components/hotels/room-board";
import { loadPickerGuests } from "@/lib/guests/picker";
import { friendGroup, rsvpStatusOf } from "@/lib/hotels/room-sharing";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { canEdit, requireWedding } from "@/lib/wedding";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("hotels"))("board.title") };
}

export default async function HotelRooms() {
  const { wedding, role } = await requireWedding();
  const sb = await createClient();
  const w = wedding.id;
  const [
    hotels,
    roomTypes,
    rooms,
    roomAssignments,
    pickerGuests,
    relationships,
    guestRows,
    allRsvps,
    tags,
    guestTags,
  ] = await Promise.all([
    fetchAll((f, t) =>
      sb.from("hotels").select("id, name, price_per_night").eq("wedding_id", w).order("created_at").range(f, t),
    ),
    fetchAll((f, t) =>
      sb.from("hotel_room_types").select("*").eq("wedding_id", w).order("sort_order").range(f, t),
    ),
    fetchAll((f, t) =>
      sb.from("hotel_rooms").select("*").eq("wedding_id", w).order("sort_order").range(f, t),
    ),
    fetchAll((f, t) =>
      sb.from("hotel_room_assignments").select("*").eq("wedding_id", w).order("id").range(f, t),
    ),
    loadPickerGuests(sb, w),
    fetchAll((f, t) =>
      sb.from("guest_relationships").select("guest_a, guest_b, type").eq("wedding_id", w).range(f, t),
    ),
    fetchAll((f, t) =>
      sb
        .from("guests")
        .select("id, age_group, household_id, accessibility, room_pref_share, room_pref_avoid")
        .eq("wedding_id", w)
        .order("id")
        .range(f, t),
    ),
    fetchAll((f, t) =>
      sb.from("rsvp_responses").select("guest_id, status").eq("wedding_id", w).order("id").range(f, t),
    ),
    fetchAll((f, t) => sb.from("tags").select("id, name, color").eq("wedding_id", w).order("id").range(f, t)),
    fetchAll((f, t) =>
      sb.from("guest_tags").select("guest_id, tag_id").eq("wedding_id", w).order("id").range(f, t),
    ),
  ]);

  const guestExtra = new Map(guestRows.map((g) => [g.id, g]));
  const statuses = new Map<string, string[]>();
  for (const r of allRsvps) statuses.set(r.guest_id, [...(statuses.get(r.guest_id) ?? []), r.status]);
  const tagMap = new Map(tags.map((t) => [t.id, { name: t.name, color: t.color }]));
  const tagsOf = new Map<string, string[]>();
  for (const gt of guestTags) tagsOf.set(gt.guest_id, [...(tagsOf.get(gt.guest_id) ?? []), gt.tag_id]);

  const boardGuests = pickerGuests.map((pg) => {
    const extra = guestExtra.get(pg.id);
    const householdId = extra?.household_id ?? pg.householdId;
    return {
      ...pg,
      householdId,
      ageGroup: extra?.age_group ?? "adult",
      accessibility: extra?.accessibility ?? null,
      rsvpStatus: rsvpStatusOf(statuses.get(pg.id) ?? []),
      roomPrefShare: extra?.room_pref_share ?? null,
      roomPrefAvoid: extra?.room_pref_avoid ?? null,
      group: friendGroup(
        { householdId, householdName: pg.householdName, tagIds: tagsOf.get(pg.id) ?? [] },
        tagMap,
      ),
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
