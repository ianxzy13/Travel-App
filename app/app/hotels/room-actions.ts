"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { roomAssignmentSchema, roomSchema, roomTypeSchema } from "@/lib/validation/places";
import { canEdit, requireWedding } from "@/lib/wedding";
import { fail, invalid, noPermission } from "@/lib/errors";

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

// ── Room types ──

export async function saveRoomType(
  hotelId: string,
  input: unknown,
  id?: string,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await editor();
  if (!ctx || !z.uuid().safeParse(hotelId).success) return noPermission();
  const parsed = roomTypeSchema.safeParse(input);
  if (!parsed.success) return await invalid(parsed.error);
  const v = parsed.data;
  const row = {
    name: v.name,
    beds: v.beds,
    max_guests: v.maxGuests,
    has_crib: v.hasCrib,
    accessible: v.accessible,
    price_per_night: v.pricePerNight,
    count: v.count,
    notes: v.notes || null,
  };

  if (id) {
    const { error } = await ctx.sb
      .from("hotel_room_types")
      .update(row)
      .eq("id", id)
      .eq("wedding_id", ctx.wedding.id);
    if (error) return fail("saveRoomType", error);
    done();
    return { ok: true, data: { id } };
  }

  const maxSort = await ctx.sb
    .from("hotel_room_types")
    .select("sort_order")
    .eq("hotel_id", hotelId)
    .eq("wedding_id", ctx.wedding.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();
  const nextSort = (maxSort.data?.sort_order ?? -1) + 1;

  const { data, error } = await ctx.sb
    .from("hotel_room_types")
    .insert({ ...row, hotel_id: hotelId, wedding_id: ctx.wedding.id, sort_order: nextSort })
    .select("id")
    .single();
  if (error) return fail("saveRoomType", error);
  done();
  return { ok: true, data: { id: data.id } };
}

export async function deleteRoomType(id: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !z.uuid().safeParse(id).success) return noPermission();
  const { error } = await ctx.sb
    .from("hotel_room_types")
    .delete()
    .eq("id", id)
    .eq("wedding_id", ctx.wedding.id);
  if (error) return fail("deleteRoomType", error);
  return done();
}

// ── Rooms ──

export async function saveRoom(
  hotelId: string,
  input: unknown,
  id?: string,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await editor();
  if (!ctx || !z.uuid().safeParse(hotelId).success) return noPermission();
  const parsed = roomSchema.safeParse(input);
  if (!parsed.success) return await invalid(parsed.error);
  const v = parsed.data;
  const row = {
    room_number: v.roomNumber,
    room_type_id: v.roomTypeId || null,
    floor: v.floor || null,
    is_locked: v.isLocked,
    notes: v.notes || null,
  };

  if (id) {
    const { error } = await ctx.sb
      .from("hotel_rooms")
      .update(row)
      .eq("id", id)
      .eq("wedding_id", ctx.wedding.id);
    if (error) return fail("saveRoom", error);
    done();
    return { ok: true, data: { id } };
  }

  const maxSort = await ctx.sb
    .from("hotel_rooms")
    .select("sort_order")
    .eq("hotel_id", hotelId)
    .eq("wedding_id", ctx.wedding.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();
  const nextSort = (maxSort.data?.sort_order ?? -1) + 1;

  const { data, error } = await ctx.sb
    .from("hotel_rooms")
    .insert({ ...row, hotel_id: hotelId, wedding_id: ctx.wedding.id, sort_order: nextSort })
    .select("id")
    .single();
  if (error) return fail("saveRoom", error);
  done();
  return { ok: true, data: { id: data.id } };
}

export async function deleteRoom(id: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !z.uuid().safeParse(id).success) return noPermission();
  const { error } = await ctx.sb
    .from("hotel_rooms")
    .delete()
    .eq("id", id)
    .eq("wedding_id", ctx.wedding.id);
  if (error) return fail("deleteRoom", error);
  return done();
}

export async function generateRooms(hotelId: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !z.uuid().safeParse(hotelId).success) return noPermission();
  const wid = ctx.wedding.id;

  const { data: types } = await ctx.sb
    .from("hotel_room_types")
    .select("id, name, count")
    .eq("hotel_id", hotelId)
    .eq("wedding_id", wid)
    .order("sort_order");
  if (!types?.length) return fail("generateRooms", "no room types");

  const { data: existing } = await ctx.sb
    .from("hotel_rooms")
    .select("room_number")
    .eq("hotel_id", hotelId)
    .eq("wedding_id", wid);
  const usedNumbers = new Set((existing ?? []).map((r) => r.room_number));

  const rows: {
    wedding_id: string;
    hotel_id: string;
    room_type_id: string;
    room_number: string;
    sort_order: number;
  }[] = [];
  let sort = (existing?.length ?? 0);
  let counter = 100;

  for (const t of types) {
    const { count: existingOfType } = await ctx.sb
      .from("hotel_rooms")
      .select("id", { count: "exact", head: true })
      .eq("hotel_id", hotelId)
      .eq("room_type_id", t.id)
      .eq("wedding_id", wid);
    const needed = t.count - (existingOfType ?? 0);
    for (let i = 0; i < needed; i++) {
      while (usedNumbers.has(String(counter))) counter++;
      rows.push({
        wedding_id: wid,
        hotel_id: hotelId,
        room_type_id: t.id,
        room_number: String(counter),
        sort_order: sort++,
      });
      usedNumbers.add(String(counter));
      counter++;
    }
  }

  if (rows.length) {
    const { error } = await ctx.sb.from("hotel_rooms").insert(rows);
    if (error) return fail("generateRooms", error);
  }
  return done();
}

// ── Room assignments ──

export async function assignGuestToRoom(input: unknown): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return noPermission();
  const parsed = roomAssignmentSchema.safeParse(input);
  if (!parsed.success) return await invalid(parsed.error);
  const v = parsed.data;

  const { error } = await ctx.sb.from("hotel_room_assignments").upsert(
    {
      wedding_id: ctx.wedding.id,
      room_id: v.roomId,
      guest_id: v.guestId,
      check_in: v.checkIn || null,
      check_out: v.checkOut || null,
      needs_crib: v.needsCrib,
    },
    { onConflict: "guest_id" },
  );
  if (error) return fail("assignGuest", error);
  return done();
}

export async function unassignGuestFromRoom(guestId: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !z.uuid().safeParse(guestId).success) return noPermission();
  const { error } = await ctx.sb
    .from("hotel_room_assignments")
    .delete()
    .eq("guest_id", guestId)
    .eq("wedding_id", ctx.wedding.id);
  if (error) return fail("unassignGuest", error);
  return done();
}

export async function bulkAssignGuests(
  assignments: unknown[],
): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return noPermission();

  const schema = z.array(
    z.object({
      roomId: z.uuid(),
      guestId: z.uuid(),
      checkIn: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
      checkOut: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
      needsCrib: z.boolean(),
    }),
  ).max(2000);

  const parsed = schema.safeParse(assignments);
  if (!parsed.success) return await invalid(parsed.error);

  if (parsed.data.length) {
    const { error } = await ctx.sb.from("hotel_room_assignments").upsert(
      parsed.data.map((a) => ({
        wedding_id: ctx.wedding.id,
        room_id: a.roomId,
        guest_id: a.guestId,
        check_in: a.checkIn || null,
        check_out: a.checkOut || null,
        needs_crib: a.needsCrib,
      })),
      { onConflict: "guest_id" },
    );
    if (error) return fail("bulkAssign", error);
  }
  return done();
}

export async function autoArrangeRoomAssignments(
  input: { roomId: string; guestId: string }[],
): Promise<ActionResult<{ placed: number; unplaced: number }>> {
  const ctx = await editor();
  if (!ctx) return noPermission();

  const schema = z
    .array(z.object({ roomId: z.uuid(), guestId: z.uuid() }))
    .max(2000);
  const parsed = schema.safeParse(input);
  if (!parsed.success) return await invalid(parsed.error);

  if (parsed.data.length) {
    const { error } = await ctx.sb.from("hotel_room_assignments").upsert(
      parsed.data.map((a) => ({
        wedding_id: ctx.wedding.id,
        room_id: a.roomId,
        guest_id: a.guestId,
        check_in: null,
        check_out: null,
        needs_crib: false,
      })),
      { onConflict: "guest_id" },
    );
    if (error) return fail("autoArrange", error);
  }
  done();
  return { ok: true, data: { placed: parsed.data.length, unplaced: 0 } };
}

export async function clearRoomAssignments(roomId: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !z.uuid().safeParse(roomId).success) return noPermission();
  const { error } = await ctx.sb
    .from("hotel_room_assignments")
    .delete()
    .eq("room_id", roomId)
    .eq("wedding_id", ctx.wedding.id);
  if (error) return fail("clearRoom", error);
  return done();
}
