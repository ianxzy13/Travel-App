import "server-only";
import { getLocale } from "next-intl/server";
import { starterTexts } from "@/lib/i18n/defaults";
import { fetchAll } from "@/lib/supabase/fetch-all";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Loads every guest-related row for one wedding (paged past the 1000-row limit). */
export async function loadGuestData(sb: Supabase, weddingId: string) {
  const [guests, households, invites, guestTags, events, tags, relationships, responses] =
    await Promise.all([
      fetchAll((from, to) =>
        sb.from("guests").select("*").eq("wedding_id", weddingId).order("id").range(from, to),
      ),
      fetchAll((from, to) =>
        sb.from("households").select("*").eq("wedding_id", weddingId).order("id").range(from, to),
      ),
      fetchAll((from, to) =>
        sb
          .from("guest_event_invites")
          .select("guest_id, event_id")
          .eq("wedding_id", weddingId)
          .order("id")
          .range(from, to),
      ),
      fetchAll((from, to) =>
        sb
          .from("guest_tags")
          .select("guest_id, tag_id")
          .eq("wedding_id", weddingId)
          .order("id")
          .range(from, to),
      ),
      fetchAll((from, to) =>
        sb
          .from("events")
          .select("id, name")
          .eq("wedding_id", weddingId)
          .order("sort_order")
          .range(from, to),
      ),
      fetchAll((from, to) =>
        sb
          .from("tags")
          .select("id, name, color")
          .eq("wedding_id", weddingId)
          .order("name")
          .range(from, to),
      ),
      fetchAll((from, to) =>
        sb
          .from("guest_relationships")
          .select("*")
          .eq("wedding_id", weddingId)
          .order("id")
          .range(from, to),
      ),
      fetchAll((from, to) =>
        sb
          .from("rsvp_responses")
          .select("guest_id, event_id, status")
          .eq("wedding_id", weddingId)
          .order("id")
          .range(from, to),
      ),
    ]);
  // default events nobody has renamed ("Ceremony"…) in the viewer's language
  const shown = await starterTexts(await getLocale());
  return {
    guests,
    households,
    invites,
    guestTags,
    events: events.map((e) => ({ ...e, name: shown(e.name) })),
    tags,
    relationships,
    responses,
  };
}
