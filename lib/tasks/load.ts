import { getTranslations } from "next-intl/server";
import "server-only";
import type { WeddingRow } from "@/lib/database.types";
import { fetchAll } from "@/lib/supabase/fetch-all";
import type { createClient } from "@/lib/supabase/server";
import type { Progress } from "./timeline";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const count = (r: { count: number | null }) => r.count ?? 0;

/** What the rest of the app says about the planning progress (for "looks done" hints). */
export async function loadProgress(
  sb: Supabase,
  wedding: Pick<WeddingRow, "id" | "budget_total">,
): Promise<Progress> {
  const wid = wedding.id;
  const head = { count: "exact" as const, head: true };
  const [
    guests,
    pins,
    venues,
    site,
    hotels,
    emails,
    schedule,
    vendors,
    categories,
    seated,
    attending,
  ] = await Promise.all([
    sb.from("guests").select("id", head).eq("wedding_id", wid),
    sb.from("pins").select("id", head).eq("wedding_id", wid),
    sb.from("venues").select("id", head).eq("wedding_id", wid).eq("status", "booked"),
    sb.from("website_settings").select("published").eq("wedding_id", wid).maybeSingle(),
    sb.from("hotels").select("id", head).eq("wedding_id", wid).eq("status", "block_confirmed"),
    sb.from("email_sends").select("id", head).eq("wedding_id", wid),
    sb.from("schedule_items").select("id", head).eq("wedding_id", wid),
    sb.from("vendors").select("category_id").eq("wedding_id", wid).eq("status", "booked"),
    sb.from("budget_categories").select("id, name").eq("wedding_id", wid),
    sb.from("seat_assignments").select("guest_id", head).eq("wedding_id", wid),
    fetchAll((f, t) =>
      sb
        .from("rsvp_responses")
        .select("guest_id")
        .eq("wedding_id", wid)
        .eq("status", "attending")
        .order("guest_id")
        .range(f, t),
    ),
  ]);
  const names = new Map((categories.data ?? []).map((c) => [c.id, c.name]));
  const attendingCount = new Set(attending.map((r) => r.guest_id)).size;
  return {
    budgetSet: wedding.budget_total != null,
    guests: count(guests),
    pins: count(pins),
    venueBooked: count(venues) > 0,
    websitePublished: !!site.data?.published,
    roomBlockConfirmed: count(hotels) > 0,
    invitesSent: count(emails) > 0,
    scheduleItems: count(schedule),
    bookedVendorCategories: (vendors.data ?? [])
      .map((v) => (v.category_id ? names.get(v.category_id) : undefined))
      .filter((n): n is string => !!n),
    seatingDone: attendingCount > 0 && count(seated) >= attendingCount,
  };
}

/** Names of everyone in the wedding (for "assigned to"). */
export async function loadMembers(sb: Supabase, weddingId: string) {
  const someone = (await getTranslations("tasks"))("someone");
  const { data } = await sb
    .from("wedding_members")
    .select("user_id, role, profile:profiles(full_name, email)")
    .eq("wedding_id", weddingId)
    .order("created_at");
  return (data ?? []).map((m) => ({
    id: m.user_id,
    role: m.role,
    name: m.profile?.full_name || m.profile?.email?.split("@")[0] || someone,
  }));
}
