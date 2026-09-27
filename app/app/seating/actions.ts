"use server";

import { err } from "@/lib/errors";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { canEdit, requireWedding } from "@/lib/wedding";

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
