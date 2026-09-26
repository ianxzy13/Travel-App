import "server-only";
import { guestDisplayName } from "@/lib/guests/model";
import { fetchAll } from "@/lib/supabase/fetch-all";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** All guests as { id, name, household } for pickers, plus whether they're attending anything. */
export async function loadPickerGuests(sb: Supabase, weddingId: string) {
  const [guests, households, attending] = await Promise.all([
    fetchAll((f, t) =>
      sb.from("guests").select("id, first_name, last_name, household_id, plus_one_of").eq("wedding_id", weddingId).order("id").range(f, t),
    ),
    fetchAll((f, t) => sb.from("households").select("id, name").eq("wedding_id", weddingId).order("id").range(f, t)),
    fetchAll((f, t) =>
      sb.from("rsvp_responses").select("guest_id").eq("wedding_id", weddingId).eq("status", "attending").order("guest_id").range(f, t),
    ),
  ]);
  const householdName = new Map(households.map((h) => [h.id, h.name]));
  const firstName = new Map(guests.map((g) => [g.id, g.first_name]));
  const yes = new Set(attending.map((a) => a.guest_id));
  return guests
    .map((g) => ({
      id: g.id,
      name: guestDisplayName(g, g.plus_one_of ? firstName.get(g.plus_one_of) : null),
      householdId: g.household_id,
      householdName: householdName.get(g.household_id) ?? "",
      attending: yes.has(g.id),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
