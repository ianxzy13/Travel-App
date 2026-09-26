"use server";

import type { ActionResult } from "@/lib/action-result";
import { isOwnFile, removeFiles } from "@/lib/files";
import { createClient } from "@/lib/supabase/server";
import { canEdit, requireWedding } from "@/lib/wedding";

/**
 * Removes a file that was uploaded in a form but then replaced or cancelled.
 * Only deletes it if nothing in the database refers to it.
 */
export async function discardUpload(path: string): Promise<ActionResult> {
  const { wedding, role } = await requireWedding();
  if (!canEdit(role) || !isOwnFile(path, wedding.id)) return { ok: false, error: "Not allowed." };
  const sb = await createClient();
  const [{ count: e }, { count: v }, { count: p }, { count: pin }] = await Promise.all([
    sb.from("expenses").select("id", { count: "exact", head: true }).eq("receipt_path", path),
    sb.from("vendors").select("id", { count: "exact", head: true }).eq("contract_path", path),
    sb.from("venues").select("id", { count: "exact", head: true }).contains("photo_paths", [path]),
    sb.from("pins").select("id", { count: "exact", head: true }).eq("image_path", path),
  ]);
  if (!e && !v && !p && !pin) await removeFiles(sb, [path]);
  return { ok: true };
}
