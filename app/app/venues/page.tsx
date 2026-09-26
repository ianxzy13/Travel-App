import type { Metadata } from "next";
import { VenuesPage } from "@/components/venues/venues-page";
import { FILES_BUCKET } from "@/lib/files";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { canEdit, requireWedding } from "@/lib/wedding";

export const metadata: Metadata = { title: "Venues" };

export default async function Venues() {
  const { wedding, role } = await requireWedding();
  const sb = await createClient();
  const [venues, checklist, { count: attending }] = await Promise.all([
    fetchAll((f, t) => sb.from("venues").select("*").eq("wedding_id", wedding.id).order("created_at").range(f, t)),
    fetchAll((f, t) =>
      sb.from("venue_checklist_items").select("*").eq("wedding_id", wedding.id).order("sort_order").range(f, t),
    ),
    supabaseAttending(sb, wedding.id),
  ]);

  // Temporary links (1 hour) for each venue's first photo.
  const covers = venues.map((v) => v.photo_paths[0]).filter(Boolean);
  const { data: signed } = covers.length
    ? await sb.storage.from(FILES_BUCKET).createSignedUrls(covers, 3600)
    : { data: [] };
  const coverUrl = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

  return (
    <VenuesPage
      venues={venues.map((v) => ({
        ...v,
        price: v.price == null ? null : Number(v.price),
        coverUrl: v.photo_paths[0] ? (coverUrl.get(v.photo_paths[0]) ?? null) : null,
        checklist: checklist.filter((c) => c.venue_id === v.id),
      }))}
      weddingId={wedding.id}
      currency={wedding.currency}
      location={wedding.location}
      guestCount={attending || wedding.estimated_guests}
      canEdit={canEdit(role)}
    />
  );
}

/** Number of distinct guests who said yes to at least one event. */
async function supabaseAttending(sb: Awaited<ReturnType<typeof createClient>>, weddingId: string) {
  const rows = await fetchAll((f, t) =>
    sb
      .from("rsvp_responses")
      .select("guest_id")
      .eq("wedding_id", weddingId)
      .eq("status", "attending")
      .order("guest_id")
      .range(f, t),
  );
  return { count: new Set(rows.map((r) => r.guest_id)).size };
}
