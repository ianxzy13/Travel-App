"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { syncStayDates } from "@/lib/hotels/stay-sync";
import {
  bookedDatesSchema,
  hotelGuestsSchema,
  hotelSchema,
  peoplePerRoomSchema,
  stayDatesSchema,
} from "@/lib/validation/places";
import { canEdit, requireWedding } from "@/lib/wedding";
import { fail, invalid, noPermission } from "@/lib/errors";

async function editor() {
  const { wedding, role } = await requireWedding();
  if (!canEdit(role)) return null;
  return { wedding, sb: await createClient() };
}

function done(): ActionResult {
  revalidatePath("/app/hotels");
  revalidatePath("/app/hotels/stays");
  revalidatePath("/app/hotels/rooms");
  revalidatePath("/app");
  return { ok: true };
}

export async function saveHotel(
  input: unknown,
  id?: string,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await editor();
  if (!ctx) return noPermission();
  const parsed = hotelSchema.safeParse(input);
  if (!parsed.success) return await invalid(parsed.error);
  const v = parsed.data;
  const row = {
    name: v.name,
    status: v.status,
    address: v.address || null,
    distance: v.distance || null,
    website: v.website || null,
    booking_url: v.bookingUrl || null,
    price_per_night: v.pricePerNight,
    rooms_held: v.roomsHeld,
    rooms_booked: v.roomsBooked,
    discount_code: v.discountCode || null,
    cutoff_date: v.cutoffDate || null,
    show_on_website: v.showOnWebsite,
    for_couple: v.forCouple,
    notes: v.notes || null,
    group_rate_email: v.groupRateEmail || null,
    group_rate_notes: v.groupRateNotes || null,
    hold_date: v.holdDate || null,
    release_date: v.releaseDate || null,
  };

  if (id) {
    const { error } = await ctx.sb
      .from("hotels")
      .update(row)
      .eq("id", id)
      .eq("wedding_id", ctx.wedding.id);
    if (error) return fail("saveHotel", error);
    done();
    return { ok: true, data: { id } };
  }
  const { data, error } = await ctx.sb
    .from("hotels")
    .insert({ ...row, wedding_id: ctx.wedding.id })
    .select("id")
    .single();
  if (error) return fail("saveHotel", error);
  done();
  return { ok: true, data: { id: data.id } };
}

export async function deleteHotel(id: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !z.uuid().safeParse(id).success) return noPermission();
  const { error } = await ctx.sb
    .from("hotels")
    .delete()
    .eq("id", id)
    .eq("wedding_id", ctx.wedding.id);
  if (error) return fail("deleteHotel", error);
  return done();
}

/**
 * Makes the hotel's guest list exactly `input`. Guests who were staying at
 * another hotel are moved here (a guest has one hotel).
 */
export async function setHotelGuests(hotelId: string, input: unknown): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !z.uuid().safeParse(hotelId).success) return noPermission();
  const parsed = hotelGuestsSchema.safeParse(input);
  if (!parsed.success) return await invalid(parsed.error);
  const wid = ctx.wedding.id;
  const keep = parsed.data.map((g) => g.guestId);

  let del = ctx.sb
    .from("hotel_guest_assignments")
    .delete()
    .eq("hotel_id", hotelId)
    .eq("wedding_id", wid);
  if (keep.length) del = del.not("guest_id", "in", `(${keep.join(",")})`);
  const { error: delError } = await del;
  if (delError) return fail("setHotelGuests", delError);

  if (parsed.data.length) {
    const { error } = await ctx.sb.from("hotel_guest_assignments").upsert(
      parsed.data.map((g) => ({
        wedding_id: wid,
        hotel_id: hotelId,
        guest_id: g.guestId,
        room: g.room || null,
        check_in: g.checkIn || null,
        check_out: g.checkOut || null,
      })),
      { onConflict: "guest_id" },
    );
    if (error) return fail("setHotelGuests", error);
    // Fill empty dates from the guest's stay; hand-typed dates stay as they are.
    const sync = await syncStayDates(ctx.sb, wid, keep, true);
    if (sync) return fail("setHotelGuests", sync.error);
  }
  return done();
}

/** The dates the hotel is booked for. Guests without their own dates follow them. */
export async function saveBookedDates(hotelId: string, input: unknown): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !z.uuid().safeParse(hotelId).success) return noPermission();
  const parsed = bookedDatesSchema.safeParse(input);
  if (!parsed.success) return await invalid(parsed.error);
  const { error } = await ctx.sb
    .from("hotels")
    .update({ booked_from: parsed.data.from, booked_to: parsed.data.to })
    .eq("id", hotelId)
    .eq("wedding_id", ctx.wedding.id);
  if (error) return fail("saveBookedDates", error);
  const sync = await syncStayDates(ctx.sb, ctx.wedding.id, null);
  if (sync) return fail("saveBookedDates", sync.error);
  return done();
}

/** How many people the couple puts in one room at this hotel (for "rooms needed"). */
export async function savePeoplePerRoom(hotelId: string, input: unknown): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !z.uuid().safeParse(hotelId).success) return noPermission();
  const parsed = peoplePerRoomSchema.safeParse(input);
  if (!parsed.success) return await invalid(parsed.error);
  const { error } = await ctx.sb
    .from("hotels")
    .update({ people_per_room: parsed.data })
    .eq("id", hotelId)
    .eq("wedding_id", ctx.wedding.id);
  if (error) return fail("savePeoplePerRoom", error);
  revalidatePath("/app/hotels/stays");
  return { ok: true };
}

/** Set when some guests arrive and/or leave; null puts that side back to the booked date. */
export async function setStayDates(input: unknown): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return noPermission();
  const parsed = stayDatesSchema.safeParse(input);
  if (!parsed.success) return await invalid(parsed.error);
  const { guestIds, from, to } = parsed.data;
  const wid = ctx.wedding.id;
  const patch: { stay_from?: string | null; stay_to?: string | null } = {};
  if (from !== undefined) patch.stay_from = from;
  if (to !== undefined) patch.stay_to = to;
  if (!Object.keys(patch).length) return { ok: true };
  const { error } = await ctx.sb
    .from("guests")
    .update(patch)
    .eq("wedding_id", wid)
    .in("id", guestIds);
  if (error) return fail("setStayDates", error);
  const sync = await syncStayDates(ctx.sb, wid, guestIds);
  if (sync) return fail("setStayDates", sync.error);
  return done();
}
