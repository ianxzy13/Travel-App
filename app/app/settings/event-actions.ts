"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { eventSchema } from "@/lib/validation/guest";
import { canManage, requireWedding } from "@/lib/wedding";
import { fail, invalid, noPermission } from "@/lib/errors";
import { contentTranslations } from "@/lib/i18n/content-locale";
import { inviteUninvitedGuests } from "@/lib/rsvp/invite";

async function editor() {
  const { wedding, role } = await requireWedding();
  if (!canManage(role)) return null;
  return { wedding, supabase: await createClient() };
}

function done(): ActionResult {
  revalidatePath("/app", "layout");
  return { ok: true };
}

/** Invites the guests who have no invitation yet. The event itself is saved, so a failure is only logged. */
async function inviteEveryone(ctx: NonNullable<Awaited<ReturnType<typeof editor>>>, eventId: string) {
  const { error } = await inviteUninvitedGuests(ctx.supabase, ctx.wedding.id, eventId);
  if (error) console.error("[inviteEveryone]", error);
}

export async function saveEvent(input: unknown, eventId?: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return noPermission();
  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) return await invalid(parsed.error);
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
    const { data: created, error } = await ctx.supabase
      .from("events")
      .insert({ ...row, wedding_id: ctx.wedding.id, sort_order: (last?.sort_order ?? -1) + 1 })
      .select("id")
      .single();
    if (error) return fail("saveEvent", error);
    // The wedding's first event: invite everyone, so the guests can RSVP to it.
    if (!last) await inviteEveryone(ctx, created.id);
  }
  return done();
}

export async function deleteEvent(eventId: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return noPermission();
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
  if (!ctx) return noPermission();
  if (!z.array(z.uuid()).max(50).safeParse(orderedIds).success) return noPermission();

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

/** One click to add the default Ceremony & Reception event. */
export async function addDefaultEvents(): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return noPermission();
  const date = ctx.wedding.wedding_date;
  const names = await contentTranslations(ctx.wedding, "onboarding");
  const { count } = await ctx.supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("wedding_id", ctx.wedding.id);
  const { data: created, error } = await ctx.supabase
    .from("events")
    .insert({
      wedding_id: ctx.wedding.id,
      name: names("defaults.ceremonyReception"),
      event_date: date,
      sort_order: 0,
      meal_choice: true,
    })
    .select("id")
    .single();
  if (error) return fail("addDefaultEvents", error);
  // The wedding's first event: invite everyone, so the guests can RSVP to it.
  if (!count) await inviteEveryone(ctx, created.id);
  return done();
}
