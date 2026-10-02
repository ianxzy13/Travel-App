"use server";

import { revalidatePath } from "next/cache";
import { err, fail, noPermission } from "@/lib/errors";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { canEdit, requireWedding } from "@/lib/wedding";

async function editor() {
  const { wedding, role } = await requireWedding();
  if (!canEdit(role)) return null;
  return { wedding, supabase: await createClient() };
}

function done(): ActionResult {
  revalidatePath("/app", "layout");
  return { ok: true };
}

// The editor sends small batches of changes (see lib/seating/state.ts toPayload).
const payloadSchema = z.object({
  layout: z.object({ room_width: z.number().int(), room_height: z.number().int() }).optional(),
  objects: z
    .array(
      z.object({
        id: z.uuid(),
        kind: z.string().max(20),
        label: z.string().max(60).nullable(),
        number: z.number().int().nullable(),
        x: z.number().finite(),
        y: z.number().finite(),
        rotation: z.number().finite(),
        width: z.number().finite(),
        height: z.number().finite(),
        seat_count: z.number().int(),
        ends: z.boolean(),
      }),
    )
    .max(500),
  deleted_objects: z.array(z.uuid()).max(500),
  assign: z
    .array(
      z.object({ guest_id: z.uuid(), object_id: z.uuid(), seat_index: z.number().int().min(0) }),
    )
    .max(3000),
  unassign: z.array(z.uuid()).max(3000),
});

/**
 * Saves seating changes. `retry: true` means a temporary problem (try again
 * later); false means the change was rejected (the editor reloads).
 */
export async function saveSeatingChanges(
  layoutId: string,
  payload: unknown,
): Promise<ActionResult | { ok: false; error: string; retry: boolean }> {
  const { role } = await requireWedding();
  if (!canEdit(role)) return { ...(await err("viewOnly")), retry: false };

  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success || !z.uuid().safeParse(layoutId).success) {
    return { ...(await err("notSaved")), retry: false };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("apply_seating_changes", {
    p_layout_id: layoutId,
    p_changes: parsed.data,
  });
  if (error) {
    console.error("[saveSeatingChanges]", error);
    // Postgres rule violations (codes starting with 23, or our own messages) won't fix themselves.
    const rejected =
      error.code?.startsWith("23") ||
      ["seat_does_not_exist", "not_allowed", "layout_not_found"].some((m) =>
        error.message.includes(m),
      );
    return {
      ...(await err(rejected ? "seatingConflict" : "saveRetrying")),
      retry: !rejected,
    };
  }
  return { ok: true };
}

export async function duplicateLayout(
  layoutId: string,
  name: string,
): Promise<ActionResult<string>> {
  const ctx = await editor();
  if (!ctx) return noPermission();
  if (!z.uuid().safeParse(layoutId).success) return fail("duplicateLayout", "invalid id");

  const sb = ctx.supabase;
  const { data: src } = await sb
    .from("seating_layouts")
    .select("*")
    .eq("id", layoutId)
    .eq("wedding_id", ctx.wedding.id)
    .single();
  if (!src) return fail("duplicateLayout", "not found");

  const { data: layout, error: insertErr } = await sb
    .from("seating_layouts")
    .insert({
      wedding_id: src.wedding_id,
      event_id: src.event_id,
      room_width: src.room_width,
      room_height: src.room_height,
      name: name.trim().slice(0, 60),
      is_active: false,
    })
    .select("id")
    .single();
  if (insertErr || !layout) return fail("duplicateLayout", insertErr);

  const { data: objects } = await sb
    .from("seating_objects")
    .select("*")
    .eq("layout_id", layoutId);
  if (objects?.length) {
    // one insert for all tables (ids are made here, so seats can be mapped right away)
    const idMap = new Map(objects.map((o) => [o.id, crypto.randomUUID()]));
    const { error: objErr } = await sb.from("seating_objects").insert(
      objects.map((o) => ({
        id: idMap.get(o.id)!,
        wedding_id: o.wedding_id,
        layout_id: layout.id,
        kind: o.kind,
        label: o.label,
        number: o.number,
        x: o.x,
        y: o.y,
        rotation: o.rotation,
        width: o.width,
        height: o.height,
        seat_count: o.seat_count,
        ends: o.ends,
      })),
    );
    if (objErr) {
      await sb.from("seating_layouts").delete().eq("id", layout.id);
      return fail("duplicateLayout", objErr);
    }
    const { data: assignments } = await sb
      .from("seat_assignments")
      .select("guest_id, object_id, seat_index")
      .eq("layout_id", layoutId);
    if (assignments?.length) {
      const mapped = assignments
        .filter((a) => idMap.has(a.object_id))
        .map((a) => ({
          wedding_id: ctx.wedding.id,
          layout_id: layout.id,
          guest_id: a.guest_id,
          object_id: idMap.get(a.object_id)!,
          seat_index: a.seat_index,
        }));
      if (mapped.length) {
        const { error: seatErr } = await sb.from("seat_assignments").insert(mapped);
        if (seatErr) console.error("[duplicateLayout] seats", seatErr);
      }
    }
  }

  revalidatePath("/app", "layout");
  return { ok: true, data: layout.id };
}

export async function renameLayout(
  layoutId: string,
  name: string,
): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return noPermission();
  if (!z.uuid().safeParse(layoutId).success) return fail("renameLayout", "invalid id");
  const trimmed = name.trim().slice(0, 60);
  if (!trimmed) return fail("renameLayout", "name required");
  const { error } = await ctx.supabase
    .from("seating_layouts")
    .update({ name: trimmed })
    .eq("id", layoutId)
    .eq("wedding_id", ctx.wedding.id);
  if (error) return fail("renameLayout", error);
  return done();
}

export async function switchActiveLayout(layoutId: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return noPermission();
  if (!z.uuid().safeParse(layoutId).success) return fail("switchLayout", "invalid id");
  const sb = ctx.supabase;

  const { data: target } = await sb
    .from("seating_layouts")
    .select("event_id")
    .eq("id", layoutId)
    .eq("wedding_id", ctx.wedding.id)
    .single();
  if (!target) return fail("switchLayout", "not found");

  await sb
    .from("seating_layouts")
    .update({ is_active: false })
    .eq("event_id", target.event_id)
    .eq("wedding_id", ctx.wedding.id);
  const { error } = await sb
    .from("seating_layouts")
    .update({ is_active: true })
    .eq("id", layoutId);
  if (error) return fail("switchLayout", error);
  return done();
}

export async function deleteLayout(layoutId: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return noPermission();
  if (!z.uuid().safeParse(layoutId).success) return fail("deleteLayout", "invalid id");
  const sb = ctx.supabase;

  const { data: target } = await sb
    .from("seating_layouts")
    .select("event_id, is_active")
    .eq("id", layoutId)
    .eq("wedding_id", ctx.wedding.id)
    .single();
  if (!target) return fail("deleteLayout", "not found");

  const { count } = await sb
    .from("seating_layouts")
    .select("id", { count: "exact", head: true })
    .eq("event_id", target.event_id);
  if ((count ?? 0) <= 1) return fail("deleteLayout", "cannot delete last layout");

  await sb.from("seat_assignments").delete().eq("layout_id", layoutId);
  await sb.from("seating_objects").delete().eq("layout_id", layoutId);
  const { error } = await sb
    .from("seating_layouts")
    .delete()
    .eq("id", layoutId)
    .eq("wedding_id", ctx.wedding.id);
  if (error) return fail("deleteLayout", error);

  if (target.is_active) {
    const { data: next } = await sb
      .from("seating_layouts")
      .select("id")
      .eq("event_id", target.event_id)
      .order("created_at")
      .limit(1)
      .single();
    if (next) {
      await sb.from("seating_layouts").update({ is_active: true }).eq("id", next.id);
    }
  }
  return done();
}
