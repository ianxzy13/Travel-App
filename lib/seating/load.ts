import "server-only";
import type { SeatingLayoutRow, SeatingObjectRow, SeatAssignmentRow } from "@/lib/database.types";
import { nameLabels } from "@/lib/guests/labels";
import { guestDisplayName } from "@/lib/guests/model";
import { fetchAll } from "@/lib/supabase/fetch-all";
import type { createClient } from "@/lib/supabase/server";
import type { SeatingGuest, SeatingObject, SeatingRelationship, SeatingState } from "./types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export function toSeatingObject(r: SeatingObjectRow): SeatingObject {
  return {
    id: r.id,
    kind: r.kind,
    label: r.label,
    number: r.number,
    x: r.x,
    y: r.y,
    rotation: r.rotation,
    width: r.width,
    height: r.height,
    seatCount: r.seat_count,
    ends: r.ends,
  };
}

export function toState(
  layout: Pick<SeatingLayoutRow, "room_width" | "room_height">,
  objects: SeatingObjectRow[],
  assignments: Pick<SeatAssignmentRow, "guest_id" | "object_id" | "seat_index">[],
): SeatingState {
  return {
    room: { width: layout.room_width, height: layout.room_height },
    objects: Object.fromEntries(objects.map((o) => [o.id, toSeatingObject(o)])),
    assignments: Object.fromEntries(
      assignments.map((a) => [
        a.guest_id,
        { guestId: a.guest_id, objectId: a.object_id, seatIndex: a.seat_index },
      ]),
    ),
  };
}

export type SeatingData = {
  layout: SeatingLayoutRow;
  state: SeatingState;
  /** everyone invited to this event (the panel filters to "attending" by default) */
  guests: SeatingGuest[];
  relationships: SeatingRelationship[];
  tags: { id: string; name: string }[];
  mealOptions: { id: string; name: string }[];
};

/** Finds (or, for editors, creates) the floor plan for an event. */
export async function getOrCreateLayout(
  sb: Supabase,
  weddingId: string,
  eventId: string,
  canEdit: boolean,
) {
  const find = () =>
    sb.from("seating_layouts").select("*").eq("event_id", eventId).eq("is_active", true).maybeSingle();
  const { data } = await find();
  if (data || !canEdit) return data;
  // ignoreDuplicates: if a collaborator created it at the same moment, just use theirs
  await sb
    .from("seating_layouts")
    .upsert(
      { wedding_id: weddingId, event_id: eventId },
      { onConflict: "event_id", ignoreDuplicates: true },
    );
  return (await find()).data;
}

/** All layouts (scenarios) for an event, ordered by creation time. */
export async function loadEventLayouts(sb: Supabase, eventId: string) {
  const { data } = await sb
    .from("seating_layouts")
    .select("id, name, is_active")
    .eq("event_id", eventId)
    .order("created_at");
  return data ?? [];
}

/** Everything the seating editor needs for one floor plan. */
export async function loadSeatingData(
  sb: Supabase,
  layout: SeatingLayoutRow,
): Promise<SeatingData> {
  const wid = layout.wedding_id;
  const labels = await nameLabels();
  const [
    objects,
    assignments,
    invites,
    responses,
    guests,
    households,
    guestTags,
    tags,
    relationships,
    meals,
  ] = await Promise.all([
    fetchAll((f, t) =>
      sb.from("seating_objects").select("*").eq("layout_id", layout.id).order("id").range(f, t),
    ),
    fetchAll((f, t) =>
      sb
        .from("seat_assignments")
        .select("guest_id, object_id, seat_index")
        .eq("layout_id", layout.id)
        .order("guest_id")
        .range(f, t),
    ),
    fetchAll((f, t) =>
      sb
        .from("guest_event_invites")
        .select("guest_id")
        .eq("event_id", layout.event_id)
        .order("id")
        .range(f, t),
    ),
    fetchAll((f, t) =>
      sb
        .from("rsvp_responses")
        .select("guest_id, status, meal_option_id")
        .eq("event_id", layout.event_id)
        .order("id")
        .range(f, t),
    ),
    fetchAll((f, t) => sb.from("guests").select("*").eq("wedding_id", wid).order("id").range(f, t)),
    fetchAll((f, t) =>
      sb.from("households").select("id, name").eq("wedding_id", wid).order("id").range(f, t),
    ),
    fetchAll((f, t) =>
      sb
        .from("guest_tags")
        .select("guest_id, tag_id")
        .eq("wedding_id", wid)
        .order("id")
        .range(f, t),
    ),
    fetchAll((f, t) =>
      sb.from("tags").select("id, name").eq("wedding_id", wid).order("name").range(f, t),
    ),
    fetchAll((f, t) =>
      sb
        .from("guest_relationships")
        .select("guest_a, guest_b, type")
        .eq("wedding_id", wid)
        .order("id")
        .range(f, t),
    ),
    fetchAll((f, t) =>
      sb
        .from("meal_options")
        .select("id, name")
        .eq("wedding_id", wid)
        .order("sort_order")
        .order("created_at")
        .range(f, t),
    ),
  ]);

  const invited = new Set(invites.map((i) => i.guest_id));
  const seated = new Set(assignments.map((a) => a.guest_id));
  const rsvp = new Map(responses.map((r) => [r.guest_id, r]));
  const householdName = new Map(households.map((h) => [h.id, h.name]));
  const firstName = new Map(guests.map((g) => [g.id, g.first_name]));
  const tagsOf = new Map<string, string[]>();
  for (const gt of guestTags)
    tagsOf.set(gt.guest_id, [...(tagsOf.get(gt.guest_id) ?? []), gt.tag_id]);

  return {
    layout,
    state: toState(layout, objects, assignments),
    // invited guests, plus anyone still seated who is no longer invited (so they can be removed)
    guests: guests
      .filter((g) => invited.has(g.id) || seated.has(g.id))
      .map((g) => ({
        id: g.id,
        name: guestDisplayName(g, g.plus_one_of ? firstName.get(g.plus_one_of) : null, labels),
        firstName: g.first_name,
        lastName: g.last_name,
        householdId: g.household_id,
        householdName: householdName.get(g.household_id) ?? "",
        side: g.side,
        ageGroup: g.age_group,
        tagIds: tagsOf.get(g.id) ?? [],
        languages: g.languages ?? [],
        dietary: g.dietary,
        accessibility: g.accessibility,
        plusOneOf: g.plus_one_of,
        rsvp: invited.has(g.id) ? (rsvp.get(g.id)?.status ?? null) : "declined",
        mealOptionId: rsvp.get(g.id)?.meal_option_id ?? null,
      })),
    relationships: relationships.map((r) => ({
      guestA: r.guest_a,
      guestB: r.guest_b,
      type: r.type,
    })),
    tags,
    mealOptions: meals,
  };
}
