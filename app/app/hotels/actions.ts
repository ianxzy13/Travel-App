"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, type ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { hotelGuestsSchema, hotelSchema } from "@/lib/validation/places";
import { canEdit, requireWedding } from "@/lib/wedding";

const NO_PERMISSION = { ok: false as const, error: "You don't have permission to change hotels." };

async function editor() {
  const { wedding, role } = await requireWedding();
  if (!canEdit(role)) return null;
  return { wedding, sb: await createClient() };
}

function done(): ActionResult {
  revalidatePath("/app/hotels");
  revalidatePath("/app");
  return { ok: true };
}

export async function saveHotel(input: unknown, id?: string): Promise<ActionResult<{ id: string }>> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  const parsed = hotelSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
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
  };

  if (id) {
    const { error } = await ctx.sb.from("hotels").update(row).eq("id", id).eq("wedding_id", ctx.wedding.id);
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
  if (!ctx || !z.uuid().safeParse(id).success) return NO_PERMISSION;
  const { error } = await ctx.sb.from("hotels").delete().eq("id", id).eq("wedding_id", ctx.wedding.id);
  if (error) return fail("deleteHotel", error);
  return done();
}

/**
 * Makes the hotel's guest list exactly `input`. Guests who were staying at
 * another hotel are moved here (a guest has one hotel).
 */
export async function setHotelGuests(hotelId: string, input: unknown): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !z.uuid().safeParse(hotelId).success) return NO_PERMISSION;
  const parsed = hotelGuestsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const wid = ctx.wedding.id;
  const keep = parsed.data.map((g) => g.guestId);

  let del = ctx.sb.from("hotel_guest_assignments").delete().eq("hotel_id", hotelId).eq("wedding_id", wid);
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
  }
  return done();
}
