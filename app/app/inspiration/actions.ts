"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, type ActionResult } from "@/lib/action-result";
import { isOwnFile, removeFiles } from "@/lib/files";
import { cleanTags } from "@/lib/inspiration/layout";
import { getLinkPreview, type LinkPreview } from "@/lib/inspiration/link-preview";
import {
  getPhotoForSaving,
  isUnsplashConfigured,
  searchPhotos,
  type UnsplashPhoto,
} from "@/lib/inspiration/unsplash";
import { createClient } from "@/lib/supabase/server";
import {
  boardSchema,
  hexList,
  linkPinSchema,
  pinUpdateSchema,
  uploadPinSchema,
} from "@/lib/validation/inspiration";
import { canEdit, requireUser, requireWedding } from "@/lib/wedding";

const NO_PERMISSION = { ok: false as const, error: "You don't have permission to change the boards." };
const id = z.uuid();

async function editor() {
  const { wedding, role } = await requireWedding();
  if (!canEdit(role)) return null;
  return { wedding, sb: await createClient() };
}

async function member() {
  const user = await requireUser();
  const { wedding } = await requireWedding();
  return { user, wedding, sb: await createClient() };
}

function done(): ActionResult {
  revalidatePath("/app/inspiration");
  revalidatePath("/app");
  return { ok: true };
}

type Sb = Awaited<ReturnType<typeof createClient>>;

/** Sort value that puts a new pin first on its board. */
async function topOrder(sb: Sb, boardId: string) {
  const { data } = await sb
    .from("pins")
    .select("sort_order")
    .eq("board_id", boardId)
    .order("sort_order")
    .limit(1)
    .maybeSingle();
  return (data?.sort_order ?? 1) - 1;
}

// ---------- boards ----------

export async function createBoard(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  const parsed = boardSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { count } = await ctx.sb.from("boards").select("id", { count: "exact", head: true }).eq("wedding_id", ctx.wedding.id);
  const { data, error } = await ctx.sb
    .from("boards")
    .insert({
      wedding_id: ctx.wedding.id,
      name: parsed.data.name,
      description: parsed.data.description || null,
      sort_order: count ?? 0,
    })
    .select("id")
    .single();
  if (error) return fail("createBoard", error);
  done();
  return { ok: true, data: { id: data.id } };
}

export async function updateBoard(boardId: string, input: unknown): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !id.safeParse(boardId).success) return NO_PERMISSION;
  const parsed = boardSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { error } = await ctx.sb
    .from("boards")
    .update({ name: parsed.data.name, description: parsed.data.description || null })
    .eq("id", boardId)
    .eq("wedding_id", ctx.wedding.id);
  if (error) return fail("updateBoard", error);
  return done();
}

export async function deleteBoard(boardId: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !id.safeParse(boardId).success) return NO_PERMISSION;
  const { data: files } = await ctx.sb.from("pins").select("image_path").eq("board_id", boardId);
  const { error } = await ctx.sb.from("boards").delete().eq("id", boardId).eq("wedding_id", ctx.wedding.id);
  if (error) return fail("deleteBoard", error);
  await removeFiles(ctx.sb, (files ?? []).map((f) => f.image_path));
  return done();
}

export async function reorderBoards(ids: string[]): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !z.array(z.uuid()).max(100).safeParse(ids).success) return NO_PERMISSION;
  const results = await Promise.all(
    ids.map((bid, i) => ctx.sb.from("boards").update({ sort_order: i }).eq("id", bid).eq("wedding_id", ctx.wedding.id)),
  );
  const error = results.find((r) => r.error)?.error;
  if (error) return fail("reorderBoards", error);
  return done();
}

/** Turns the public read-only link on (new random token) or off. */
export async function setBoardSharing(boardId: string, on: boolean): Promise<ActionResult<{ shareId: string | null }>> {
  const ctx = await editor();
  if (!ctx || !id.safeParse(boardId).success) return NO_PERMISSION;
  const shareId = on ? randomBytes(18).toString("base64url") : null;
  const { error } = await ctx.sb
    .from("boards")
    .update({ share_id: shareId })
    .eq("id", boardId)
    .eq("wedding_id", ctx.wedding.id);
  if (error) return fail("setBoardSharing", error);
  done();
  return { ok: true, data: { shareId } };
}

// ---------- adding pins ----------

export async function addUploadedPin(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  const parsed = uploadPinSchema.safeParse(input);
  if (!parsed.success || !isOwnFile(parsed.data.path, ctx.wedding.id)) return NO_PERMISSION;
  const v = parsed.data;
  const { error } = await ctx.sb.from("pins").insert({
    wedding_id: ctx.wedding.id,
    board_id: v.boardId,
    image_path: v.path,
    width: v.width,
    height: v.height,
    title: v.title || null,
    sort_order: await topOrder(ctx.sb, v.boardId),
    created_by: user.id,
  });
  if (error) return fail("addUploadedPin", error);
  return done();
}

/** Looks up a pasted link (image or web page) on the server, safely. */
export async function previewLink(url: string): Promise<ActionResult<LinkPreview>> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  try {
    return { ok: true, data: await getLinkPreview(url) };
  } catch (e) {
    const message = e instanceof Error && !/fetch failed|ENOTFOUND|aborted/i.test(e.message) ? e.message : "We couldn't open that link.";
    return { ok: false, error: message };
  }
}

export async function addLinkPin(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  const parsed = linkPinSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  const { error } = await ctx.sb.from("pins").insert({
    wedding_id: ctx.wedding.id,
    board_id: v.boardId,
    image_url: v.imageUrl,
    source_url: v.sourceUrl || null,
    title: v.title || null,
    width: v.width,
    height: v.height,
    sort_order: await topOrder(ctx.sb, v.boardId),
    created_by: user.id,
  });
  if (error) return fail("addLinkPin", error);
  return done();
}

export async function discoverPhotos(
  query: string,
  page: number,
): Promise<ActionResult<{ photos: UnsplashPhoto[]; hasMore: boolean }>> {
  await requireWedding();
  if (!isUnsplashConfigured) return { ok: false, error: "Unsplash isn't set up yet (see README)." };
  try {
    return { ok: true, data: await searchPhotos(query.slice(0, 80), Math.max(1, Math.min(50, page))) };
  } catch (e) {
    return fail("discoverPhotos", e, e instanceof Error ? e.message : "Unsplash isn't responding.");
  }
}

/** Saves an Unsplash photo; details (and credit) are re-read from Unsplash, not trusted from the browser. */
export async function addUnsplashPin(boardId: string, photoId: string): Promise<ActionResult> {
  const user = await requireUser();
  const ctx = await editor();
  if (!ctx || !id.safeParse(boardId).success || !/^[\w-]{1,40}$/.test(photoId)) return NO_PERMISSION;
  if (!isUnsplashConfigured) return { ok: false, error: "Unsplash isn't set up yet." };
  try {
    const p = await getPhotoForSaving(photoId);
    const { error } = await ctx.sb.from("pins").insert({
      wedding_id: ctx.wedding.id,
      board_id: boardId,
      image_url: p.full,
      width: p.width,
      height: p.height,
      title: p.alt ? p.alt.slice(0, 200) : null,
      source_url: p.pageUrl,
      credit_name: p.photographer,
      credit_url: p.photographerUrl,
      unsplash_id: p.id,
      sort_order: await topOrder(ctx.sb, boardId),
      created_by: user.id,
    });
    if (error) return fail("addUnsplashPin", error);
    return done();
  } catch (e) {
    return fail("addUnsplashPin", e, "Couldn't save that photo. Please try again.");
  }
}

// ---------- editing pins ----------

export async function updatePin(pinId: string, input: unknown): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !id.safeParse(pinId).success) return NO_PERMISSION;
  const parsed = pinUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  const { error } = await ctx.sb
    .from("pins")
    .update({
      title: v.title || null,
      note: v.note || null,
      source_url: v.sourceUrl || null,
      tags: cleanTags(v.tags),
      status: v.status,
      budget_category_id: v.budgetCategoryId,
      vendor_id: v.vendorId,
    })
    .eq("id", pinId)
    .eq("wedding_id", ctx.wedding.id);
  if (error) return fail("updatePin", error);
  return done();
}

/** Moves a pin (to another board and/or position). */
export async function movePin(pinId: string, boardId: string, sortOrder: number): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !id.safeParse(pinId).success || !id.safeParse(boardId).success || !Number.isFinite(sortOrder)) {
    return NO_PERMISSION;
  }
  const { error } = await ctx.sb
    .from("pins")
    .update({ board_id: boardId, sort_order: sortOrder })
    .eq("id", pinId)
    .eq("wedding_id", ctx.wedding.id);
  if (error) return fail("movePin", error);
  return done();
}

export async function deletePin(pinId: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !id.safeParse(pinId).success) return NO_PERMISSION;
  const { data, error } = await ctx.sb
    .from("pins")
    .delete()
    .eq("id", pinId)
    .eq("wedding_id", ctx.wedding.id)
    .select("image_path");
  if (error) return fail("deletePin", error);
  await removeFiles(ctx.sb, (data ?? []).map((r) => r.image_path));
  return done();
}

// ---------- hearts & comments (every member, including viewers) ----------

export async function toggleHeart(pinId: string): Promise<ActionResult> {
  const { user, wedding, sb } = await member();
  if (!id.safeParse(pinId).success) return NO_PERMISSION;
  const { data: existing } = await sb
    .from("pin_reactions")
    .select("pin_id")
    .eq("pin_id", pinId)
    .eq("user_id", user.id)
    .maybeSingle();
  const { error } = existing
    ? await sb.from("pin_reactions").delete().eq("pin_id", pinId).eq("user_id", user.id)
    : await sb.from("pin_reactions").insert({ pin_id: pinId, user_id: user.id, wedding_id: wedding.id });
  if (error) return fail("toggleHeart", error);
  revalidatePath("/app/inspiration");
  return { ok: true };
}

export async function addComment(pinId: string, body: string): Promise<ActionResult> {
  const { user, wedding, sb } = await member();
  const text = body.trim();
  if (!id.safeParse(pinId).success || !text || text.length > 2000) return { ok: false, error: "Please write a comment (up to 2000 characters)." };
  const { error } = await sb.from("pin_comments").insert({ pin_id: pinId, user_id: user.id, wedding_id: wedding.id, body: text });
  if (error) return fail("addComment", error);
  revalidatePath("/app/inspiration");
  return { ok: true };
}

export async function deleteComment(commentId: string): Promise<ActionResult> {
  const { user, sb } = await member();
  if (!id.safeParse(commentId).success) return NO_PERMISSION;
  const { error } = await sb.from("pin_comments").delete().eq("id", commentId).eq("user_id", user.id);
  if (error) return fail("deleteComment", error);
  revalidatePath("/app/inspiration");
  return { ok: true };
}

// ---------- colour palette ----------

export async function addPaletteColors(hexes: string[], sourcePinId?: string): Promise<ActionResult> {
  const ctx = await editor();
  const parsed = hexList.safeParse(hexes);
  if (!ctx || !parsed.success) return NO_PERMISSION;
  const { data: existing } = await ctx.sb.from("palette_colors").select("hex").eq("wedding_id", ctx.wedding.id);
  const have = new Set((existing ?? []).map((c) => c.hex));
  const fresh = [...new Set(parsed.data.map((h) => h.toLowerCase()))].filter((h) => !have.has(h));
  if (have.size + fresh.length > 12) return { ok: false, error: "Your palette holds up to 12 colours. Remove some first." };
  if (!fresh.length) return { ok: true };
  const { error } = await ctx.sb.from("palette_colors").insert(
    fresh.map((hex, i) => ({
      wedding_id: ctx.wedding.id,
      hex,
      source_pin_id: sourcePinId && id.safeParse(sourcePinId).success ? sourcePinId : null,
      sort_order: have.size + i,
    })),
  );
  if (error) return fail("addPaletteColors", error);
  return done();
}

export async function removePaletteColor(colorId: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !id.safeParse(colorId).success) return NO_PERMISSION;
  const { error } = await ctx.sb.from("palette_colors").delete().eq("id", colorId).eq("wedding_id", ctx.wedding.id);
  if (error) return fail("removePaletteColor", error);
  return done();
}
