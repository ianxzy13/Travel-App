"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, type ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { eventSchema } from "@/lib/validation/guest";
import { canEdit, requireWedding } from "@/lib/wedding";

const NO_PERMISSION = { ok: false as const, error: "You don't have permission to change events." };

async function editor() {
  const { wedding, role } = await requireWedding();
  if (!canEdit(role)) return null;
  return { wedding, supabase: await createClient() };
}

function done(): ActionResult {
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function saveEvent(input: unknown, eventId?: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;

  const row = {
    name: v.name,
    event_date: v.eventDate || null,
    start_time: v.startTime || null,
    end_time: v.endTime || null,
    venue_name: v.venueName || null,
    address: v.address || null,
    dress_code: v.dressCode || null,
    description: v.description || null,
  };

  if (eventId) {
    const { error } = await ctx.supabase
      .from("events")
      .update(row)
      .eq("id", eventId)
      .eq("wedding_id", ctx.wedding.id);
    if (error) return fail("saveEvent", error);
  } else {
    // New events go to the end of the list.
    const { data: last } = await ctx.supabase
      .from("events")
      .select("sort_order")
      .eq("wedding_id", ctx.wedding.id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await ctx.supabase
      .from("events")
      .insert({ ...row, wedding_id: ctx.wedding.id, sort_order: (last?.sort_order ?? -1) + 1 });
    if (error) return fail("saveEvent", error);
  }
  return done();
}

export async function deleteEvent(eventId: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  // Invitations to this event are removed automatically (cascade).
  const { error } = await ctx.supabase
    .from("events")
    .delete()
    .eq("id", eventId)
    .eq("wedding_id", ctx.wedding.id);
  if (error) return fail("deleteEvent", error);
  return done();
}

/** Saves a new order, e.g. after moving an event up or down. */
export async function reorderEvents(orderedIds: string[]): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (!z.array(z.uuid()).max(50).safeParse(orderedIds).success) return NO_PERMISSION;

  const results = await Promise.all(
    orderedIds.map((id, index) =>
      ctx.supabase
        .from("events")
        .update({ sort_order: index })
        .eq("id", id)
        .eq("wedding_id", ctx.wedding.id),
    ),
  );
  const error = results.find((r) => r.error)?.error;
  if (error) return fail("reorderEvents", error);
  return done();
}

/** One click to add the usual Ceremony + Reception (for weddings created before events existed). */
export async function addDefaultEvents(): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  const date = ctx.wedding.wedding_date;
  const { error } = await ctx.supabase.from("events").insert([
    { wedding_id: ctx.wedding.id, name: "Ceremony", event_date: date, sort_order: 0 },
    { wedding_id: ctx.wedding.id, name: "Reception", event_date: date, sort_order: 1 },
  ]);
  if (error) return fail("addDefaultEvents", error);
  return done();
}
