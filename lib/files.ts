import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Private bucket for receipts, contracts and photos: <wedding_id>/<folder>/<file>. */
export const FILES_BUCKET = "wedding-files";

/** A stored file path must live inside this wedding's folder. */
export function isOwnFile(path: string | null | undefined, weddingId: string) {
  return !path || (path.startsWith(`${weddingId}/`) && !path.includes(".."));
}

/** Deletes files that are no longer referenced (errors are only logged). */
export async function removeFiles(sb: Supabase, paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => !!p);
  if (!list.length) return;
  const { error } = await sb.storage.from(FILES_BUCKET).remove(list);
  if (error) console.error("[removeFiles]", error);
}
