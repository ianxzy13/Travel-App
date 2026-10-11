import { createClient } from "@/lib/supabase/server";

export async function logActivity(
  weddingId: string,
  actorId: string,
  kind: string,
  subject?: string,
  detail?: Record<string, string | number | boolean | null>,
) {
  const sb = await createClient();
  await sb.from("activity_log").insert({
    wedding_id: weddingId,
    actor_id: actorId,
    kind,
    subject: subject ?? null,
    detail: detail ?? null,
  });
}
