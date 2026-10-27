import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { effectiveStay } from "./nights";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Copies guests' stay dates (their own, or their hotel's booked dates) onto
 * their room and hotel assignments, so rooming lists and the guest trip page
 * show the right check-in/check-out. `guestIds` limits it to those guests;
 * `onlyEmpty` leaves dates someone typed by hand alone.
 */
export async function syncStayDates(
  sb: Supabase,
  weddingId: string,
  guestIds: string[] | null,
  onlyEmpty = false,
): Promise<{ error: unknown } | null> {
  if (guestIds && !guestIds.length) return null;
  let roomQuery = sb
    .from("hotel_room_assignments")
    .select("id, guest_id, room_id, check_in, check_out")
    .eq("wedding_id", weddingId);
  let hotelQuery = sb
    .from("hotel_guest_assignments")
    .select("id, guest_id, hotel_id, check_in, check_out")
    .eq("wedding_id", weddingId);
  if (guestIds) {
    roomQuery = roomQuery.in("guest_id", guestIds);
    hotelQuery = hotelQuery.in("guest_id", guestIds);
  }
  const [hotels, rooms, roomRows, hotelRows] = await Promise.all([
    sb.from("hotels").select("id, booked_from, booked_to").eq("wedding_id", weddingId),
    sb.from("hotel_rooms").select("id, hotel_id").eq("wedding_id", weddingId),
    roomQuery,
    hotelQuery,
  ]);
  const readError = hotels.error ?? rooms.error ?? roomRows.error ?? hotelRows.error;
  if (readError) return { error: readError };
  const ids = [
    ...new Set([...(roomRows.data ?? []), ...(hotelRows.data ?? [])].map((r) => r.guest_id)),
  ];
  if (!ids.length) return null;
  let guestQuery = sb.from("guests").select("id, stay_from, stay_to").eq("wedding_id", weddingId);
  if (guestIds) guestQuery = guestQuery.in("id", ids);
  const { data: guests, error: guestError } = await guestQuery.limit(5000);
  if (guestError) return { error: guestError };

  const booked = new Map(
    (hotels.data ?? []).map((h) => [h.id, { from: h.booked_from, to: h.booked_to }]),
  );
  const hotelOfRoom = new Map((rooms.data ?? []).map((r) => [r.id, r.hotel_id]));
  const own = new Map((guests ?? []).map((g) => [g.id, { from: g.stay_from, to: g.stay_to }]));
  const target = (guestId: string, hotelId: string | undefined) => {
    const stay = effectiveStay(
      own.get(guestId) ?? { from: null, to: null },
      (hotelId && booked.get(hotelId)) || null,
    );
    return { check_in: stay?.from ?? null, check_out: stay?.to ?? null };
  };
  const stale = <R extends { check_in: string | null; check_out: string | null }>(
    row: R,
    want: { check_in: string | null; check_out: string | null },
  ) =>
    (!onlyEmpty || (!row.check_in && !row.check_out)) &&
    (row.check_in !== want.check_in || row.check_out !== want.check_out);

  const updates: PromiseLike<{ error: unknown }>[] = [];
  for (const r of roomRows.data ?? []) {
    const want = target(r.guest_id, hotelOfRoom.get(r.room_id));
    if (stale(r, want)) updates.push(sb.from("hotel_room_assignments").update(want).eq("id", r.id));
  }
  for (const r of hotelRows.data ?? []) {
    const want = target(r.guest_id, r.hotel_id);
    if (stale(r, want))
      updates.push(sb.from("hotel_guest_assignments").update(want).eq("id", r.id));
  }
  for (const res of await Promise.all(updates)) if (res.error) return { error: res.error };
  return null;
}
