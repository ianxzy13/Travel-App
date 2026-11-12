import "server-only";
import { fetchAll } from "@/lib/supabase/fetch-all";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Invites every guest who isn't invited to any event yet to `eventId`.
 * Without an invitation a household has nothing to reply to, so it drops off
 * the RSVP page (this happens when the only event is deleted and added again).
 * Returns how many guests were invited.
 */
export async function inviteUninvitedGuests(
  sb: Supabase,
  weddingId: string,
  eventId: string,
): Promise<{ count: number; error: unknown }> {
  try {
    const [guests, invites] = await Promise.all([
      fetchAll((f, t) =>
        sb.from("guests").select("id").eq("wedding_id", weddingId).order("id").range(f, t),
      ),
      fetchAll((f, t) =>
        sb
          .from("guest_event_invites")
          .select("guest_id")
          .eq("wedding_id", weddingId)
          .order("id")
          .range(f, t),
      ),
    ]);
    const invited = new Set(invites.map((i) => i.guest_id));
    const rows = guests
      .filter((g) => !invited.has(g.id))
      .map((g) => ({ wedding_id: weddingId, guest_id: g.id, event_id: eventId }));
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await sb
        .from("guest_event_invites")
        .upsert(rows.slice(i, i + 500), { onConflict: "guest_id,event_id", ignoreDuplicates: true });
      if (error) return { count: 0, error };
    }
    return { count: rows.length, error: null };
  } catch (error) {
    return { count: 0, error };
  }
}
