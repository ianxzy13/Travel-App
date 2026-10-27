"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { roomLabels } from "@/lib/hotels/room-sharing";
import { syncStayDates } from "@/lib/hotels/stay-sync";
import {
  quickRoomsSchema,
  roomAssignmentSchema,
  roomDetailsSchema,
  roomSchema,
  roomTypeSchema,
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
  revalidatePath("/app/hotels/rooms");
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

export async function generateRooms(
  hotelId: string,
  opts: { typeId?: string; start?: string } = {},
): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !z.uuid().safeParse(hotelId).success) return noPermission();
  if (opts.typeId && !z.uuid().safeParse(opts.typeId).success) return noPermission();
  const wid = ctx.wedding.id;

  let typeQuery = ctx.sb
    .from("hotel_room_types")
    .select("id, name, count")
    .eq("hotel_id", hotelId)
    .eq("wedding_id", wid);
  if (opts.typeId) typeQuery = typeQuery.eq("id", opts.typeId);
  const { data: types } = await typeQuery.order("sort_order");
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
  const start = opts.start?.trim().slice(0, 30) || "100";

  for (const t of types) {
    const { count: existingOfType } = await ctx.sb
      .from("hotel_rooms")
      .select("id", { count: "exact", head: true })
      .eq("hotel_id", hotelId)
      .eq("room_type_id", t.id)
      .eq("wedding_id", wid);
    const needed = Math.max(0, t.count - (existingOfType ?? 0));
    for (const label of roomLabels(start, needed, usedNumbers)) {
      rows.push({
        wedding_id: wid,
        hotel_id: hotelId,
        room_type_id: t.id,
        room_number: label,
        sort_order: sort++,
      });
      usedNumbers.add(label);
    }
  }

  if (rows.length) {
    const { error } = await ctx.sb.from("hotel_rooms").insert(rows);
    if (error) return fail("generateRooms", error);
  }
  return done();
}

/** "Add rooms" dialog: one room type for N identical shared rooms, then create them. */
export async function addRoomsQuick(input: unknown): Promise<ActionResult<{ created: number }>> {
  const ctx = await editor();
  if (!ctx) return noPermission();
  const parsed = quickRoomsSchema.safeParse(input);
  if (!parsed.success) return await invalid(parsed.error);
  const v = parsed.data;

  const { data: hotel } = await ctx.sb
    .from("hotels")
    .select("id")
    .eq("id", v.hotelId)
    .eq("wedding_id", ctx.wedding.id)
    .maybeSingle();
  if (!hotel) return noPermission();

  const type = await saveRoomType(v.hotelId, {
    name: v.typeName,
    beds: v.beds,
    maxGuests: v.perRoom,
    hasCrib: false,
    accessible: false,
    pricePerNight: v.pricePerNight,
    count: v.count,
    notes: "",
  });
  if (!type.ok) return type;

  const made = await generateRooms(v.hotelId, { typeId: type.data.id, start: v.start });
  if (!made.ok) return made;
  return { ok: true, data: { created: v.count } };
}

/** Nickname and per-room capacity, edited right on the board. */
export async function updateRoomDetails(roomId: string, input: unknown): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !z.uuid().safeParse(roomId).success) return noPermission();
  const parsed = roomDetailsSchema.safeParse(input);
  if (!parsed.success) return await invalid(parsed.error);
  const { error } = await ctx.sb
    .from("hotel_rooms")
    .update({ name: parsed.data.name || null, capacity: parsed.data.capacity })
    .eq("id", roomId)
    .eq("wedding_id", ctx.wedding.id);
  if (error) return fail("updateRoomDetails", error);
  return done();
}

/** Put `movingId` in `targetId`'s room; `targetId` takes the mover's old room (or no room). */
export async function swapRoomGuests(movingId: string, targetId: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return noPermission();
  const ids = z.tuple([z.uuid(), z.uuid()]).safeParse([movingId, targetId]);
  if (!ids.success || movingId === targetId) return noPermission();
  const wid = ctx.wedding.id;

  const { data: rows, error: readError } = await ctx.sb
    .from("hotel_room_assignments")
    .select("guest_id, room_id")
    .eq("wedding_id", wid)
    .in("guest_id", [movingId, targetId]);
  if (readError) return fail("swapGuests", readError);
  const target = rows?.find((r) => r.guest_id === targetId);
  const moving = rows?.find((r) => r.guest_id === movingId);
  if (!target) return fail("swapGuests", "target has no room");

  const first = moving
    ? await ctx.sb
        .from("hotel_room_assignments")
        .update({ room_id: moving.room_id })
        .eq("guest_id", targetId)
        .eq("wedding_id", wid)
    : await ctx.sb
        .from("hotel_room_assignments")
        .delete()
        .eq("guest_id", targetId)
        .eq("wedding_id", wid);
  if (first.error) return fail("swapGuests", first.error);

  const { error } = await ctx.sb.from("hotel_room_assignments").upsert(
    { wedding_id: wid, room_id: target.room_id, guest_id: movingId },
    { onConflict: "guest_id" },
  );
  if (error) return fail("swapGuests", error);
  const sync = await syncStayDates(ctx.sb, wid, [movingId, targetId]);
  if (sync) return fail("swapGuests", sync.error);
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
  // Dates follow the guest's stay unless typed in here.
  const sync = await syncStayDates(ctx.sb, ctx.wedding.id, [v.guestId], true);
  if (sync) return fail("assignGuest", sync.error);
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
    const sync = await syncStayDates(
      ctx.sb,
      ctx.wedding.id,
      parsed.data.map((a) => a.guestId),
      true,
    );
    if (sync) return fail("bulkAssign", sync.error);
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
    const sync = await syncStayDates(
      ctx.sb,
      ctx.wedding.id,
      parsed.data.map((a) => a.guestId),
    );
    if (sync) return fail("autoArrange", sync.error);
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
