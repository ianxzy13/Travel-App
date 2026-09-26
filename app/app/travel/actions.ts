"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, type ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { flightSchema } from "@/lib/validation/places";
import { canEdit, requireWedding } from "@/lib/wedding";

const NO_PERMISSION = { ok: false as const, error: "You don't have permission to change travel plans." };

async function editor() {
  const { wedding, role } = await requireWedding();
  if (!canEdit(role)) return null;
  return { wedding, sb: await createClient() };
}

function done(): ActionResult {
  revalidatePath("/app/travel");
  return { ok: true };
}

export async function saveFlight(input: unknown, id?: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  const parsed = flightSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  const wid = ctx.wedding.id;
  const row = {
    category: v.category,
    direction: v.direction,
    status: v.status,
    airline: v.airline || null,
    flight_number: v.flightNumber.toUpperCase().replace(/\s+/g, "") || null,
    from_airport: v.fromAirport.toUpperCase() || null,
    to_airport: v.toAirport.toUpperCase() || null,
    depart_at: v.departAt || null,
    arrive_at: v.arriveAt || null,
    booking_ref: v.bookingRef.toUpperCase() || null,
    price: v.price,
    baggage: v.baggage || null,
    other_travellers: v.otherTravellers || null,
    needs_pickup: v.needsPickup,
    notes: v.notes || null,
  };

  let flightId = id;
  if (flightId) {
    const { error } = await ctx.sb.from("flights").update(row).eq("id", flightId).eq("wedding_id", wid);
    if (error) return fail("saveFlight", error);
  } else {
    const { data, error } = await ctx.sb.from("flights").insert({ ...row, wedding_id: wid }).select("id").single();
    if (error) return fail("saveFlight", error);
    flightId = data.id;
  }

  // travellers: replace the set
  const { error: delError } = await ctx.sb.from("flight_travellers").delete().eq("flight_id", flightId);
  if (delError) return fail("saveFlight travellers", delError);
  if (v.travellerIds.length) {
    const { error } = await ctx.sb
      .from("flight_travellers")
      .insert(v.travellerIds.map((guest_id) => ({ flight_id: flightId!, guest_id, wedding_id: wid })));
    if (error) return fail("saveFlight travellers", error);
  }
  return done();
}

export async function deleteFlight(id: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !z.uuid().safeParse(id).success) return NO_PERMISSION;
  const { error } = await ctx.sb.from("flights").delete().eq("id", id).eq("wedding_id", ctx.wedding.id);
  if (error) return fail("deleteFlight", error);
  return done();
}

export async function setDestinationAirport(code: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  const c = code.trim().toUpperCase();
  if (c && !/^[A-Z]{3}$/.test(c)) return { ok: false, error: "Use the 3-letter airport code, e.g. LIS." };
  const { error } = await ctx.sb.from("weddings").update({ destination_airport: c || null }).eq("id", ctx.wedding.id);
  if (error) return fail("setDestinationAirport", error);
  return done();
}
