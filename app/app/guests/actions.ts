"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, type ActionResult } from "@/lib/action-result";
import type { GuestRow, TagColor, TagRow } from "@/lib/database.types";
import { splitFullName, type ImportGuest } from "@/lib/guests/csv";
import { fullName } from "@/lib/guests/model";
import { createClient } from "@/lib/supabase/server";
import {
  bulkPatchSchema,
  guestFormSchema,
  householdSchema,
  importSchema,
  relationshipSchema,
  tagSchema,
  type AddressValues,
} from "@/lib/validation/guest";
import { canEdit, requireWedding } from "@/lib/wedding";

// All writes are also protected by Row Level Security in the database;
// the checks here are for clear error messages.

const NO_PERMISSION = { ok: false as const, error: "You don't have permission to change guests." };
const idsSchema = z.array(z.uuid()).min(1).max(5000);

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Runs a query per batch of 100 ids. Ids go in the request URL, which has a
 * length limit, so large selections must be split up. Returns the first error.
 */
async function inBatches(ids: string[], run: (batch: string[]) => PromiseLike<{ error: unknown }>) {
  for (let i = 0; i < ids.length; i += 100) {
    const { error } = await run(ids.slice(i, i + 100));
    if (error) return error;
  }
  return null;
}

async function editor() {
  const { wedding, role } = await requireWedding();
  if (!canEdit(role)) return null;
  return { weddingId: wedding.id, supabase: await createClient() };
}

function done(): ActionResult {
  revalidatePath("/app/guests");
  revalidatePath("/app");
  return { ok: true };
}

function addressColumns(a: AddressValues) {
  return {
    address_line1: a.line1 || null,
    address_line2: a.line2 || null,
    city: a.city || null,
    region: a.region || null,
    postal_code: a.postalCode || null,
    country: a.country || null,
  };
}

/** Makes a guest's event invitations exactly `eventIds`. */
async function setGuestEvents(
  sb: Supabase,
  weddingId: string,
  guestId: string,
  eventIds: string[],
) {
  let del = sb.from("guest_event_invites").delete().eq("guest_id", guestId);
  if (eventIds.length) del = del.not("event_id", "in", `(${eventIds.join(",")})`);
  const { error: delError } = await del;
  if (delError) throw delError;
  if (!eventIds.length) return;
  const { error } = await sb.from("guest_event_invites").upsert(
    eventIds.map((event_id) => ({ wedding_id: weddingId, guest_id: guestId, event_id })),
    { onConflict: "guest_id,event_id", ignoreDuplicates: true },
  );
  if (error) throw error;
}

/** Makes a guest's tags exactly `tagIds`. */
async function setGuestTags(sb: Supabase, weddingId: string, guestId: string, tagIds: string[]) {
  let del = sb.from("guest_tags").delete().eq("guest_id", guestId);
  if (tagIds.length) del = del.not("tag_id", "in", `(${tagIds.join(",")})`);
  const { error: delError } = await del;
  if (delError) throw delError;
  if (!tagIds.length) return;
  const { error } = await sb.from("guest_tags").upsert(
    tagIds.map((tag_id) => ({ wedding_id: weddingId, guest_id: guestId, tag_id })),
    { onConflict: "guest_id,tag_id", ignoreDuplicates: true },
  );
  if (error) throw error;
}

/**
 * Keeps a guest's plus-one row in step with the host: created when a plus-one
 * is allowed, removed when not, and always in the same household and events.
 */
async function syncPlusOne(
  sb: Supabase,
  weddingId: string,
  host: Pick<GuestRow, "id" | "household_id" | "side" | "list">,
  allowed: boolean,
  plusOneName: string,
  eventIds: string[],
) {
  const { data: existing, error } = await sb.from("guests").select("id").eq("plus_one_of", host.id);
  if (error) throw error;

  if (!allowed) {
    if (existing.length) {
      const { error: delError } = await sb.from("guests").delete().eq("plus_one_of", host.id);
      if (delError) throw delError;
    }
    return;
  }

  const [first_name, last_name] = splitFullName(plusOneName);
  const values = {
    household_id: host.household_id,
    first_name,
    last_name,
    side: host.side,
    list: host.list,
  };
  let plusOneId = existing[0]?.id;
  if (plusOneId) {
    const { error: upError } = await sb.from("guests").update(values).eq("id", plusOneId);
    if (upError) throw upError;
  } else {
    const { data, error: insError } = await sb
      .from("guests")
      .insert({ ...values, wedding_id: weddingId, plus_one_of: host.id })
      .select("id")
      .single();
    if (insError) throw insError;
    plusOneId = data.id;
  }
  await setGuestEvents(sb, weddingId, plusOneId, eventIds);
}

/** Creates (no id) or updates a guest, their household, events, tags and plus-one. */
export async function saveGuest(
  input: unknown,
  guestId?: string,
): Promise<ActionResult<{ id: string; householdId: string }>> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  const { supabase: sb, weddingId } = ctx;

  const parsed = guestFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;

  try {
    // Existing guest (if editing): needed to know if they changed household.
    let existing: Pick<GuestRow, "household_id" | "plus_one_of"> | null = null;
    if (guestId) {
      const { data } = await sb
        .from("guests")
        .select("household_id, plus_one_of")
        .eq("id", guestId)
        .eq("wedding_id", weddingId)
        .maybeSingle();
      if (!data) return { ok: false, error: "This guest no longer exists." };
      existing = data;
    }

    // Plus-ones always stay in their host's household.
    let householdId = existing?.plus_one_of ? existing.household_id : v.householdId;
    const isPlusOne = !!existing?.plus_one_of;

    if (householdId === "new") {
      const { data, error } = await sb
        .from("households")
        .insert({
          wedding_id: weddingId,
          name: v.householdName || fullName(v.firstName, v.lastName),
          ...addressColumns(v.address),
        })
        .select("id")
        .single();
      if (error) throw error;
      householdId = data.id;
    } else if (!isPlusOne) {
      const { error } = await sb
        .from("households")
        .update({
          ...(v.householdName ? { name: v.householdName } : {}),
          ...addressColumns(v.address),
        })
        .eq("id", householdId)
        .eq("wedding_id", weddingId);
      if (error) throw error;
    }

    const row = {
      household_id: householdId,
      first_name: v.firstName,
      last_name: v.lastName,
      email: v.email || null,
      phone: v.phone || null,
      side: v.side,
      age_group: v.ageGroup,
      list: v.list,
      plus_one_allowed: isPlusOne ? false : v.plusOneAllowed,
      dietary: v.dietary || null,
      accessibility: v.accessibility || null,
      notes: v.notes || null,
    };

    let id = guestId;
    if (id) {
      const { error } = await sb
        .from("guests")
        .update(row)
        .eq("id", id)
        .eq("wedding_id", weddingId);
      if (error) throw error;
    } else {
      const { data, error } = await sb
        .from("guests")
        .insert({ ...row, wedding_id: weddingId })
        .select("id")
        .single();
      if (error) throw error;
      id = data.id;
    }

    await setGuestEvents(sb, weddingId, id, v.eventIds);
    await setGuestTags(sb, weddingId, id, v.tagIds);
    if (!isPlusOne) {
      await syncPlusOne(
        sb,
        weddingId,
        { id, household_id: householdId, side: v.side, list: v.list },
        v.plusOneAllowed,
        v.plusOneName,
        v.eventIds,
      );
    }

    // Moving households can leave the old one empty.
    if (existing && existing.household_id !== householdId) {
      await sb.rpc("delete_empty_households", { wid: weddingId });
    }

    done();
    return { ok: true, data: { id, householdId } };
  } catch (error) {
    return fail("saveGuest", error, "We couldn't save this guest. Please try again.");
  }
}

export async function deleteGuests(ids: string[]): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (!idsSchema.safeParse(ids).success) return { ok: false, error: "No guests selected." };

  // Their plus-ones, invites, tags and seating rules are removed automatically (cascade).
  const error = await inBatches(ids, (batch) =>
    ctx.supabase.from("guests").delete().in("id", batch).eq("wedding_id", ctx.weddingId),
  );
  if (error) return fail("deleteGuests", error);

  await ctx.supabase.rpc("delete_empty_households", { wid: ctx.weddingId });
  return done();
}

/** Change side / list / age group of many guests at once. */
export async function bulkUpdateGuests(ids: string[], patch: unknown): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  const parsedPatch = bulkPatchSchema.safeParse(patch);
  if (!idsSchema.safeParse(ids).success || !parsedPatch.success) {
    return { ok: false, error: "Nothing to update." };
  }
  const error = await inBatches(ids, (batch) =>
    ctx.supabase
      .from("guests")
      .update(parsedPatch.data)
      .in("id", batch)
      .eq("wedding_id", ctx.weddingId),
  );
  if (error) return fail("bulkUpdateGuests", error);
  return done();
}

/** Invite (or un-invite) many guests to an event. Their plus-ones follow along. */
export async function bulkSetEvent(
  ids: string[],
  eventId: string,
  invited: boolean,
): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (!idsSchema.safeParse(ids).success || !z.uuid().safeParse(eventId).success) {
    return { ok: false, error: "Nothing to update." };
  }
  const sb = ctx.supabase;

  const plusOneIds: string[] = [];
  const poError = await inBatches(ids, async (batch) => {
    const { data, error } = await sb.from("guests").select("id").in("plus_one_of", batch);
    plusOneIds.push(...(data ?? []).map((p) => p.id));
    return { error };
  });
  if (poError) return fail("bulkSetEvent", poError);
  const allIds = [...new Set([...ids, ...plusOneIds])];

  const error = invited
    ? (
        await sb.from("guest_event_invites").upsert(
          allIds.map((guest_id) => ({ wedding_id: ctx.weddingId, guest_id, event_id: eventId })),
          { onConflict: "guest_id,event_id", ignoreDuplicates: true },
        )
      ).error
    : await inBatches(allIds, (batch) =>
        sb.from("guest_event_invites").delete().eq("event_id", eventId).in("guest_id", batch),
      );
  if (error) return fail("bulkSetEvent", error);
  return done();
}

/** Add (or remove) a tag on many guests. */
export async function bulkSetTag(
  ids: string[],
  tagId: string,
  add: boolean,
): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (!idsSchema.safeParse(ids).success || !z.uuid().safeParse(tagId).success) {
    return { ok: false, error: "Nothing to update." };
  }
  const error = add
    ? (
        await ctx.supabase.from("guest_tags").upsert(
          ids.map((guest_id) => ({ wedding_id: ctx.weddingId, guest_id, tag_id: tagId })),
          { onConflict: "guest_id,tag_id", ignoreDuplicates: true },
        )
      ).error
    : await inBatches(ids, (batch) =>
        ctx.supabase.from("guest_tags").delete().eq("tag_id", tagId).in("guest_id", batch),
      );
  if (error) return fail("bulkSetTag", error);
  return done();
}

// ---------- households ----------

export async function updateHousehold(id: string, input: unknown): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  const parsed = householdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (!z.uuid().safeParse(id).success) return NO_PERMISSION;

  const { error } = await ctx.supabase
    .from("households")
    .update({ name: parsed.data.name, ...addressColumns(parsed.data.address) })
    .eq("id", id)
    .eq("wedding_id", ctx.weddingId);
  if (error) return fail("updateHousehold", error);
  return done();
}

// ---------- tags ----------

const DUPLICATE = "23505"; // Postgres "unique violation" error code

export async function createTag(input: unknown): Promise<ActionResult<{ tag: TagRow }>> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  const parsed = tagSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { data, error } = await ctx.supabase
    .from("tags")
    .insert({ wedding_id: ctx.weddingId, ...parsed.data })
    .select("*")
    .single();
  if (error?.code === DUPLICATE)
    return { ok: false, error: "A tag with that name already exists." };
  if (error) return fail("createTag", error);
  revalidatePath("/app/guests");
  return { ok: true, data: { tag: data } };
}

export async function updateTag(id: string, input: unknown): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  const parsed = tagSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { error } = await ctx.supabase
    .from("tags")
    .update(parsed.data)
    .eq("id", id)
    .eq("wedding_id", ctx.weddingId);
  if (error?.code === DUPLICATE)
    return { ok: false, error: "A tag with that name already exists." };
  if (error) return fail("updateTag", error);
  return done();
}

export async function deleteTag(id: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  const { error } = await ctx.supabase
    .from("tags")
    .delete()
    .eq("id", id)
    .eq("wedding_id", ctx.weddingId);
  if (error) return fail("deleteTag", error);
  return done();
}

// ---------- seating rules (keep together / keep apart) ----------

export async function addRelationship(input: unknown): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  const parsed = relationshipSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  if (v.guestA === v.guestB) return { ok: false, error: "Please choose a different guest." };

  const { error } = await ctx.supabase.from("guest_relationships").insert({
    wedding_id: ctx.weddingId,
    guest_a: v.guestA,
    guest_b: v.guestB,
    type: v.type,
    note: v.note || null,
  });
  if (error?.code === DUPLICATE) {
    return { ok: false, error: "These two guests already have a seating rule." };
  }
  if (error) return fail("addRelationship", error);
  return done();
}

export async function removeRelationship(id: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  const { error } = await ctx.supabase
    .from("guest_relationships")
    .delete()
    .eq("id", id)
    .eq("wedding_id", ctx.weddingId);
  if (error) return fail("removeRelationship", error);
  return done();
}

// ---------- CSV import ----------

export type ImportSummary = {
  guests: number;
  households: number;
  tagsCreated: number;
  unknownEvents: string[];
};

/**
 * Imports guests from a mapped spreadsheet.
 * Households with the same name (in the file or already in the app) are merged.
 * Ids are generated here so all rows can be linked before inserting; if any
 * step fails, the new households are deleted again (which removes their guests).
 */
export async function importGuests(input: unknown): Promise<ActionResult<ImportSummary>> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const rows: ImportGuest[] = parsed.data;
  const { supabase: sb, weddingId } = ctx;
  const key = (s: string) => s.trim().toLowerCase();

  const [{ data: households }, { data: tags }, { data: events }] = await Promise.all([
    sb.from("households").select("id, name").eq("wedding_id", weddingId),
    sb.from("tags").select("id, name").eq("wedding_id", weddingId),
    sb.from("events").select("id, name").eq("wedding_id", weddingId),
  ]);

  // --- tags: reuse existing (case-insensitive), create the rest ---
  const tagIds = new Map((tags ?? []).map((t) => [key(t.name), t.id]));
  const newTags = new Map<
    string,
    { id: string; wedding_id: string; name: string; color: TagColor }
  >();
  for (const name of rows.flatMap((r) => r.tags)) {
    if (!tagIds.has(key(name)) && !newTags.has(key(name))) {
      newTags.set(key(name), { id: randomUUID(), wedding_id: weddingId, name, color: "stone" });
    }
  }
  for (const [k, t] of newTags) tagIds.set(k, t.id);

  // --- events: match by name; unknown names are reported, not created ---
  const eventIds = new Map((events ?? []).map((e) => [key(e.name), e.id]));
  const unknownEvents = new Set<string>();

  // --- households: merge by name ---
  const householdIds = new Map((households ?? []).map((h) => [key(h.name), h.id]));
  const newHouseholds: {
    id: string;
    wedding_id: string;
    name: string;
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    region: string | null;
    postal_code: string | null;
    country: string | null;
  }[] = [];

  const guestRows: GuestRow[] = [];
  const inviteRows: { wedding_id: string; guest_id: string; event_id: string }[] = [];
  const guestTagRows: { wedding_id: string; guest_id: string; tag_id: string }[] = [];
  const now = new Date().toISOString();

  const householdFor = (r: ImportGuest) => {
    let householdId = householdIds.get(key(r.household));
    if (!householdId) {
      householdId = randomUUID();
      householdIds.set(key(r.household), householdId);
      newHouseholds.push({
        id: householdId,
        wedding_id: weddingId,
        name: r.household,
        address_line1: r.addressLine1 || null,
        address_line2: r.addressLine2 || null,
        city: r.city || null,
        region: r.region || null,
        postal_code: r.postalCode || null,
        country: r.country || null,
      });
    }
    return householdId;
  };

  const eventIdsFor = (r: ImportGuest) =>
    r.events.flatMap((name) => {
      const id = eventIds.get(key(name));
      if (!id) unknownEvents.add(name);
      return id ? [id] : [];
    });

  /** Queues one guest row plus its event invites and tags. */
  const addGuest = (r: ImportGuest, evIds: string[], overrides: Partial<GuestRow> = {}) => {
    const guest: GuestRow = {
      id: randomUUID(),
      wedding_id: weddingId,
      household_id: "",
      first_name: r.firstName,
      last_name: r.lastName,
      email: r.email || null,
      phone: r.phone || null,
      side: r.side,
      age_group: r.ageGroup,
      plus_one_allowed: r.plusOneAllowed,
      plus_one_of: null,
      dietary: r.dietary || null,
      accessibility: r.accessibility || null,
      notes: r.notes || null,
      list: r.list,
      created_at: now,
      updated_at: now,
      ...overrides,
    };
    guestRows.push(guest);
    for (const event_id of evIds) {
      inviteRows.push({ wedding_id: weddingId, guest_id: guest.id, event_id });
    }
    for (const t of new Set(r.tags.map(key))) {
      guestTagRows.push({ wedding_id: weddingId, guest_id: guest.id, tag_id: tagIds.get(t)! });
    }
    return guest;
  };

  // Rows with "Plus-one of" (e.g. from our own export) are linked to their host
  // after all hosts exist; everyone else is a regular guest.
  const plusOneRows = rows.filter((r) => r.plusOneOf);
  const namedPlusOneHosts = new Set(plusOneRows.map((r) => key(r.plusOneOf)));
  const hostsByName = new Map<string, { guest: GuestRow; evIds: string[] }>();

  for (const r of rows.filter((row) => !row.plusOneOf)) {
    const evIds = eventIdsFor(r);
    const guest = addGuest(r, evIds, { household_id: householdFor(r) });
    const name = key(fullName(r.firstName, r.lastName));
    hostsByName.set(name, { guest, evIds });

    // Create the plus-one from the "Plus-one name" column, unless a separate
    // row in the file already describes this plus-one.
    if (r.plusOneAllowed && !namedPlusOneHosts.has(name)) {
      const [first_name, last_name] = splitFullName(r.plusOneName);
      addGuest({ ...r, tags: [] }, evIds, {
        household_id: guest.household_id,
        first_name,
        last_name,
        email: null,
        phone: null,
        age_group: "adult",
        plus_one_allowed: false,
        plus_one_of: guest.id,
        dietary: null,
        accessibility: null,
        notes: null,
      });
    }
  }

  for (const r of plusOneRows) {
    const host = hostsByName.get(key(r.plusOneOf));
    if (!host) {
      // Host isn't in this file: import as a regular guest.
      addGuest(r, eventIdsFor(r), { household_id: householdFor(r) });
      continue;
    }
    host.guest.plus_one_allowed = true;
    const ownEvents = eventIdsFor(r);
    addGuest(r, ownEvents.length ? ownEvents : host.evIds, {
      household_id: host.guest.household_id,
      side: host.guest.side,
      list: host.guest.list,
      plus_one_allowed: false,
      plus_one_of: host.guest.id,
    });
  }

  // Insert in dependency order. Hosts come before their plus-ones in guestRows.
  const newHouseholdIds = newHouseholds.map((h) => h.id);
  const newTagIds = [...newTags.values()].map((t) => t.id);
  try {
    const steps = [
      () => (newTags.size ? sb.from("tags").insert([...newTags.values()]) : null),
      () => (newHouseholds.length ? sb.from("households").insert(newHouseholds) : null),
      () => sb.from("guests").insert(guestRows),
      () => (inviteRows.length ? sb.from("guest_event_invites").insert(inviteRows) : null),
      () => (guestTagRows.length ? sb.from("guest_tags").insert(guestTagRows) : null),
    ];
    for (const step of steps) {
      const result = await step();
      if (result?.error) throw result.error;
    }
  } catch (error) {
    // Undo: remove what this import created (guests in existing households too).
    const guestIds = guestRows.map((g) => g.id);
    await inBatches(guestIds, (batch) => sb.from("guests").delete().in("id", batch));
    await inBatches(newHouseholdIds, (batch) => sb.from("households").delete().in("id", batch));
    await inBatches(newTagIds, (batch) => sb.from("tags").delete().in("id", batch));
    return fail(
      "importGuests",
      error,
      "The import failed and nothing was saved. Please check the file and try again.",
    );
  }

  done();
  return {
    ok: true,
    data: {
      guests: guestRows.length,
      households: newHouseholds.length,
      tagsCreated: newTags.size,
      unknownEvents: [...unknownEvents],
    },
  };
}
