"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, type ActionResult } from "@/lib/action-result";
import { DAY_TEMPLATE, fromMinutes, shiftFrom, toMinutes } from "@/lib/schedule/time";
import { createClient } from "@/lib/supabase/server";
import { scheduleItemSchema } from "@/lib/validation/tasks";
import { canEdit, requireWedding } from "@/lib/wedding";

const NO_PERMISSION = { ok: false as const, error: "You don't have permission to change the schedule." };
const id = z.uuid();
const day = z.union([z.null(), z.iso.date()]);

async function editor() {
  const { wedding, role } = await requireWedding();
  if (!canEdit(role)) return null;
  return { wedding, sb: await createClient() };
}

function done(): ActionResult {
  revalidatePath("/app/schedule");
  return { ok: true };
}

export async function saveScheduleItem(itemId: string | null, input: unknown): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || (itemId && !id.safeParse(itemId).success)) return NO_PERMISSION;
  const parsed = scheduleItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  const row = {
    // the wedding day is stored as "no date", so it follows the date if that changes
    day: v.day && v.day !== ctx.wedding.wedding_date ? v.day : null,
    start_time: v.start_time,
    duration_min: v.duration_min === "" ? null : v.duration_min,
    title: v.title,
    location: v.location || null,
    owner: v.owner || null,
    notes: v.notes || null,
    vendor_id: v.vendor_id || null,
  };
  const { error } = itemId
    ? await ctx.sb.from("schedule_items").update(row).eq("id", itemId).eq("wedding_id", ctx.wedding.id)
    : await ctx.sb.from("schedule_items").insert({ ...row, wedding_id: ctx.wedding.id });
  if (error) return fail("saveScheduleItem", error);
  return done();
}

export async function deleteScheduleItem(itemId: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !id.safeParse(itemId).success) return NO_PERMISSION;
  const { error } = await ctx.sb.from("schedule_items").delete().eq("id", itemId).eq("wedding_id", ctx.wedding.id);
  if (error) return fail("deleteScheduleItem", error);
  return done();
}

async function itemsOfDay(ctx: NonNullable<Awaited<ReturnType<typeof editor>>>, d: string | null) {
  const q = ctx.sb.from("schedule_items").select("id, start_time, duration_min").eq("wedding_id", ctx.wedding.id);
  const { data } = await (d ? q.eq("day", d) : q.is("day", null));
  return data ?? [];
}

/** Moves an item and everything after it that day by `delta` minutes (e.g. ±15). */
export async function shiftSchedule(itemId: string, forDay: string | null, delta: number): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !id.safeParse(itemId).success || !day.safeParse(forDay).success || !Number.isInteger(delta) || Math.abs(delta) > 720) {
    return NO_PERMISSION;
  }
  const updates = shiftFrom(await itemsOfDay(ctx, forDay), itemId, delta);
  const results = await Promise.all(
    updates.map((u) => ctx.sb.from("schedule_items").update({ start_time: u.start_time }).eq("id", u.id).eq("wedding_id", ctx.wedding.id)),
  );
  const error = results.find((r) => r.error)?.error;
  if (error) return fail("shiftSchedule", error);
  return done();
}

/** Adds that day's events (ceremony, reception…) as schedule items. */
export async function importEvents(forDay: string | null): Promise<ActionResult<{ added: number }>> {
  const ctx = await editor();
  if (!ctx || !day.safeParse(forDay).success) return NO_PERMISSION;
  const date = forDay ?? ctx.wedding.wedding_date;
  if (!date) return { ok: false, error: "Set your wedding date first." };
  const [{ data: events }, existing] = await Promise.all([
    ctx.sb.from("events").select("id, name, start_time, end_time, venue_name, address").eq("wedding_id", ctx.wedding.id).eq("event_date", date),
    ctx.sb.from("schedule_items").select("event_id, title, day").eq("wedding_id", ctx.wedding.id),
  ]);
  // skip events already on the schedule (linked, or an item with the same name that day)
  const sameDay = (existing.data ?? []).filter((i) => (i.day ?? ctx.wedding.wedding_date) === date);
  const have = new Set((existing.data ?? []).map((e) => e.event_id).filter(Boolean));
  const names = new Set(sameDay.map((i) => i.title.trim().toLowerCase()));
  const fresh = (events ?? []).filter((e) => e.start_time && !have.has(e.id) && !names.has(e.name.trim().toLowerCase()));
  if (!fresh.length) return { ok: true, data: { added: 0 } };
  const { error } = await ctx.sb.from("schedule_items").insert(
    fresh.map((e) => {
      const start = toMinutes(e.start_time!);
      let end = e.end_time ? toMinutes(e.end_time) : null;
      if (end != null && end < start) end += 1440;
      return {
        wedding_id: ctx.wedding.id,
        day: forDay,
        start_time: fromMinutes(start),
        duration_min: end != null ? end - start : null,
        title: e.name,
        location: [e.venue_name, e.address].filter(Boolean).join(", ") || null,
        event_id: e.id,
      };
    }),
  );
  if (error) return fail("importEvents", error);
  done();
  return { ok: true, data: { added: fresh.length } };
}

/** Fills an empty day with a typical wedding day, timed around the ceremony. */
export async function addTemplateDay(forDay: string | null, ceremonyTime: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !day.safeParse(forDay).success || !/^([01]\d|2[0-3]):[0-5]\d$/.test(ceremonyTime)) return NO_PERMISSION;
  if ((await itemsOfDay(ctx, forDay)).length) return { ok: false, error: "This day already has items. The template only fills an empty day." };
  const [{ data: events }, { data: venues }] = await Promise.all([
    ctx.sb.from("events").select("name, venue_name").eq("wedding_id", ctx.wedding.id),
    ctx.sb.from("venues").select("name, kind").eq("wedding_id", ctx.wedding.id).eq("status", "booked"),
  ]);
  // best guess at the places, from booked venues or the events' venues
  const venueFor = (role: "ceremony" | "reception") =>
    venues?.find((v) => v.kind === role || v.kind === "both")?.name ??
    events?.find((e) => e.name.toLowerCase().includes(role))?.venue_name ??
    null;
  const at = toMinutes(ceremonyTime);
  const { error } = await ctx.sb.from("schedule_items").insert(
    DAY_TEMPLATE.map((t) => ({
      wedding_id: ctx.wedding.id,
      day: forDay,
      start_time: fromMinutes(at + t.offset),
      duration_min: t.duration,
      title: t.title,
      owner: t.owner ?? null,
      location: t.location ? venueFor(t.location) : null,
    })),
  );
  if (error) return fail("addTemplateDay", error);
  return done();
}
