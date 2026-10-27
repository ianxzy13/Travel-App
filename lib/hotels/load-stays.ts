import "server-only";
import { loadPickerGuests } from "@/lib/guests/picker";
import { fetchAll } from "@/lib/supabase/fetch-all";
import type { createClient } from "@/lib/supabase/server";
import { rsvpStatusOf } from "./room-sharing";
import type { GuestSaidDates, StayGuest } from "./stays";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Everything the "who's staying when" page and its print version need. */
export async function loadStays(sb: Supabase, weddingId: string) {
  const w = weddingId;
  const [hotels, pickerGuests, guestRows, rsvps, rooms, roomAssignments, hotelAssignments, travel] =
    await Promise.all([
      fetchAll((f, t) =>
        sb
          .from("hotels")
          .select("id, name, booked_from, booked_to, people_per_room, status")
          .eq("wedding_id", w)
          .order("created_at")
          .range(f, t),
      ),
      loadPickerGuests(sb, w),
      fetchAll((f, t) =>
        sb
          .from("guests")
          .select("id, wants_hotel_room, stay_from, stay_to")
          .eq("wedding_id", w)
          .order("id")
          .range(f, t),
      ),
      fetchAll((f, t) =>
        sb
          .from("rsvp_responses")
          .select("guest_id, status")
          .eq("wedding_id", w)
          .order("id")
          .range(f, t),
      ),
      fetchAll((f, t) =>
        sb.from("hotel_rooms").select("id, hotel_id").eq("wedding_id", w).order("id").range(f, t),
      ),
      fetchAll((f, t) =>
        sb
          .from("hotel_room_assignments")
          .select("guest_id, room_id")
          .eq("wedding_id", w)
          .order("id")
          .range(f, t),
      ),
      fetchAll((f, t) =>
        sb
          .from("hotel_guest_assignments")
          .select("guest_id, hotel_id")
          .eq("wedding_id", w)
          .order("id")
          .range(f, t),
      ),
      fetchAll((f, t) =>
        sb
          .from("guest_travel")
          .select("household_id, arrival_date, departure_date")
          .eq("wedding_id", w)
          .order("id")
          .range(f, t),
      ),
    ]);

  const extra = new Map(guestRows.map((g) => [g.id, g]));
  const statuses = new Map<string, string[]>();
  for (const r of rsvps) statuses.set(r.guest_id, [...(statuses.get(r.guest_id) ?? []), r.status]);
  const hotelOfRoom = new Map(rooms.map((r) => [r.id, r.hotel_id]));
  const hotelOf = new Map(hotelAssignments.map((a) => [a.guest_id, a.hotel_id]));
  // A room is more specific than the hotel guest list.
  for (const a of roomAssignments) {
    const h = hotelOfRoom.get(a.room_id);
    if (h) hotelOf.set(a.guest_id, h);
  }

  const guests: StayGuest[] = pickerGuests.map((g) => {
    const e = extra.get(g.id);
    return {
      id: g.id,
      name: g.name,
      householdId: g.householdId,
      householdName: g.householdName,
      rsvp: rsvpStatusOf(statuses.get(g.id) ?? []),
      wantsRoom: e?.wants_hotel_room ?? null,
      stayFrom: e?.stay_from ?? null,
      stayTo: e?.stay_to ?? null,
      hotelId: hotelOf.get(g.id) ?? null,
    };
  });

  const guestSaid: Record<string, GuestSaidDates> = {};
  for (const t of travel) {
    if (t.arrival_date || t.departure_date)
      guestSaid[t.household_id] = { arrival: t.arrival_date, departure: t.departure_date };
  }

  return {
    hotels: hotels
      .filter((h) => h.status !== "rejected")
      .map((h) => ({
        id: h.id,
        name: h.name,
        booked_from: h.booked_from,
        booked_to: h.booked_to,
        people_per_room: h.people_per_room,
      })),
    guests,
    guestSaid,
  };
}
