"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import type { MusicPriority } from "@/lib/database.types";
import { fail, invalid, noPermission } from "@/lib/errors";
import { priorityFor } from "@/lib/music/songs";
import { createClient } from "@/lib/supabase/server";
import {
  momentOrderSchema,
  momentSchema,
  songOrderSchema,
  songSchema,
} from "@/lib/validation/music";
import { canEdit, requireUser, requireWedding } from "@/lib/wedding";

const id = z.uuid();

async function editor() {
  const { wedding, role } = await requireWedding();
  if (!canEdit(role)) return null;
  return { wedding, sb: await createClient() };
}

function done(): ActionResult {
  revalidatePath("/app/music");
  return { ok: true };
}

type Ctx = NonNullable<Awaited<ReturnType<typeof editor>>>;

async function momentKind(ctx: Ctx, momentId: string) {
  const { data } = await ctx.sb
    .from("music_moments")
    .select("kind")
    .eq("id", momentId)
    .eq("wedding_id", ctx.wedding.id)
    .maybeSingle();
  return data?.kind ?? null;
}

/** Puts a song at the end of a moment. */
async function nextSort(ctx: Ctx, momentId: string) {
  const { data } = await ctx.sb
    .from("music_songs")
    .select("sort_order")
    .eq("moment_id", momentId)
    .order("sort_order", { ascending: false })
    .limit(1);
  return (data?.[0]?.sort_order ?? -1) + 1;
}

// ── Songs ──

export async function saveSong(
  songId: string | null,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const ctx = await editor();
  if (!ctx || (songId && !id.safeParse(songId).success)) return noPermission();
  const parsed = songSchema.safeParse(input);
  if (!parsed.success) return await invalid(parsed.error);
  const v = parsed.data;
  const kind = await momentKind(ctx, v.momentId);
  if (!kind) return noPermission();
  const row = {
    moment_id: v.momentId,
    title: v.title,
    artist: v.artist,
    url: v.url || null,
    note: v.note || null,
    priority: priorityFor(kind, v.priority),
    language: v.language ? v.language.toUpperCase() : null,
  };

  if (songId) {
    const { data: before } = await ctx.sb
      .from("music_songs")
      .select("moment_id")
      .eq("id", songId)
      .eq("wedding_id", ctx.wedding.id)
      .maybeSingle();
    const moved = before && before.moment_id !== v.momentId;
    const { error } = await ctx.sb
      .from("music_songs")
      .update(moved ? { ...row, sort_order: await nextSort(ctx, v.momentId) } : row)
      .eq("id", songId)
      .eq("wedding_id", ctx.wedding.id);
    if (error) return fail("saveSong", error);
    done();
    return { ok: true, data: { id: songId } };
  }
  const { data, error } = await ctx.sb
    .from("music_songs")
    .insert({
      ...row,
      wedding_id: ctx.wedding.id,
      sort_order: await nextSort(ctx, v.momentId),
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return fail("saveSong", error);
  done();
  return { ok: true, data: { id: data.id } };
}

export async function deleteSong(songId: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !id.safeParse(songId).success) return noPermission();
  const { error } = await ctx.sb
    .from("music_songs")
    .delete()
    .eq("id", songId)
    .eq("wedding_id", ctx.wedding.id);
  if (error) return fail("deleteSong", error);
  return done();
}

/** New order of songs in the moments that changed (drag, up/down, move to). */
export async function reorderSongs(input: unknown): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return noPermission();
  const parsed = songOrderSchema.safeParse(input);
  if (!parsed.success) return await invalid(parsed.error);
  const wid = ctx.wedding.id;

  const songIds = parsed.data.flatMap((m) => m.songIds);
  const [{ data: moments }, { data: songs }] = await Promise.all([
    ctx.sb
      .from("music_moments")
      .select("id, kind")
      .eq("wedding_id", wid)
      .in(
        "id",
        parsed.data.map((m) => m.momentId),
      ),
    songIds.length
      ? ctx.sb.from("music_songs").select("id, priority").eq("wedding_id", wid).in("id", songIds)
      : Promise.resolve({ data: [] as { id: string; priority: MusicPriority }[] }),
  ]);
  const kind = new Map((moments ?? []).map((m) => [m.id, m.kind]));
  const priority = new Map((songs ?? []).map((s) => [s.id, s.priority]));

  const updates = parsed.data.flatMap((m) => {
    const k = kind.get(m.momentId);
    if (!k) return [];
    return m.songIds.flatMap((songId, i) => {
      const p = priority.get(songId);
      if (!p) return [];
      return [
        ctx.sb
          .from("music_songs")
          .update({ moment_id: m.momentId, sort_order: i, priority: priorityFor(k, p) })
          .eq("id", songId)
          .eq("wedding_id", wid),
      ];
    });
  });
  for (const r of await Promise.all(updates)) if (r.error) return fail("reorderSongs", r.error);
  return done();
}

// ── Moments ──

export async function saveMoment(momentId: string | null, input: unknown): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || (momentId && !id.safeParse(momentId).success)) return noPermission();
  const parsed = momentSchema.safeParse(input);
  if (!parsed.success) return await invalid(parsed.error);
  const v = parsed.data;
  const row = { name: v.name, schedule_item_id: v.scheduleItemId || null, hidden: v.hidden };
  if (momentId) {
    const { error } = await ctx.sb
      .from("music_moments")
      .update(row)
      .eq("id", momentId)
      .eq("wedding_id", ctx.wedding.id);
    if (error) return fail("saveMoment", error);
    return done();
  }
  const { data: all } = await ctx.sb
    .from("music_moments")
    .select("id, sort_order, kind")
    .eq("wedding_id", ctx.wedding.id)
    .order("sort_order", { ascending: false });
  // New moments go before "Do not play", which stays last.
  const top = Math.max(
    -1,
    ...(all ?? []).filter((m) => m.kind !== "do_not_play").map((m) => m.sort_order),
  );
  const { error } = await ctx.sb.from("music_moments").insert({
    ...row,
    wedding_id: ctx.wedding.id,
    kind: "custom",
    sort_order: top + 1,
  });
  if (error) return fail("saveMoment", error);
  const dnp = all?.find((m) => m.kind === "do_not_play");
  if (dnp && dnp.sort_order <= top + 1)
    await ctx.sb
      .from("music_moments")
      .update({ sort_order: top + 2 })
      .eq("id", dnp.id);
  return done();
}

export async function setMomentHidden(momentId: string, hidden: boolean): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !id.safeParse(momentId).success) return noPermission();
  const { error } = await ctx.sb
    .from("music_moments")
    .update({ hidden })
    .eq("id", momentId)
    .eq("wedding_id", ctx.wedding.id);
  if (error) return fail("saveMoment", error);
  return done();
}

export async function deleteMoment(momentId: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !id.safeParse(momentId).success) return noPermission();
  const { error } = await ctx.sb
    .from("music_moments")
    .delete()
    .eq("id", momentId)
    .eq("wedding_id", ctx.wedding.id);
  if (error) return fail("deleteMoment", error);
  return done();
}

export async function reorderMoments(input: unknown): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return noPermission();
  const parsed = momentOrderSchema.safeParse(input);
  if (!parsed.success) return await invalid(parsed.error);
  const results = await Promise.all(
    parsed.data.map((momentId, i) =>
      ctx.sb
        .from("music_moments")
        .update({ sort_order: i })
        .eq("id", momentId)
        .eq("wedding_id", ctx.wedding.id),
    ),
  );
  for (const r of results) if (r.error) return fail("reorderMoments", r.error);
  return done();
}

// ── Guest suggestions ──

/** Adds a guest's song to a moment and marks the suggestion as accepted. */
export async function acceptSuggestion(
  suggestionId: string,
  momentId: string,
): Promise<ActionResult> {
  const user = await requireUser();
  const ctx = await editor();
  if (!ctx || !id.safeParse(suggestionId).success || !id.safeParse(momentId).success)
    return noPermission();
  const wid = ctx.wedding.id;
  const [{ data: s }, kind] = await Promise.all([
    ctx.sb
      .from("music_suggestions")
      .select("title, artist")
      .eq("id", suggestionId)
      .eq("wedding_id", wid)
      .maybeSingle(),
    momentKind(ctx, momentId),
  ]);
  if (!s || !kind) return noPermission();
  const { error } = await ctx.sb.from("music_songs").insert({
    wedding_id: wid,
    moment_id: momentId,
    title: s.title,
    artist: s.artist,
    priority: priorityFor(kind, "nice"),
    sort_order: await nextSort(ctx, momentId),
    suggestion_id: suggestionId,
    created_by: user.id,
  });
  if (error) return fail("acceptSuggestion", error);
  const { error: e2 } = await ctx.sb
    .from("music_suggestions")
    .update({ status: "accepted" })
    .eq("id", suggestionId)
    .eq("wedding_id", wid);
  if (e2) return fail("acceptSuggestion", e2);
  return done();
}

export async function setSuggestionStatus(
  suggestionId: string,
  status: "new" | "dismissed",
): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !id.safeParse(suggestionId).success || !["new", "dismissed"].includes(status))
    return noPermission();
  const { error } = await ctx.sb
    .from("music_suggestions")
    .update({ status })
    .eq("id", suggestionId)
    .eq("wedding_id", ctx.wedding.id);
  if (error) return fail("dismissSuggestion", error);
  return done();
}
