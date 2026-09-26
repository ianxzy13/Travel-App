import "server-only";
import type { PinStatus } from "@/lib/database.types";
import { FILES_BUCKET } from "@/lib/files";
import { fetchAll } from "@/lib/supabase/fetch-all";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type PinComment = { id: string; userId: string; name: string; body: string; createdAt: string };

export type PinView = {
  id: string;
  boardId: string;
  /** what to show: a temporary private link (uploads) or the external image */
  src: string | null;
  external: boolean;
  width: number | null;
  height: number | null;
  title: string | null;
  note: string | null;
  sourceUrl: string | null;
  tags: string[];
  status: PinStatus | null;
  budgetCategoryId: string | null;
  vendorId: string | null;
  creditName: string | null;
  creditUrl: string | null;
  sortOrder: number;
  createdAt: string;
  hearts: string[];
  comments: PinComment[];
};

export type BoardView = { id: string; name: string; description: string | null; shareId: string | null; count: number };

export type InspirationData = {
  boards: BoardView[];
  pins: PinView[];
  palette: { id: string; hex: string }[];
  names: Record<string, string>;
};

/** Temporary links (1 hour) for private uploads, in one request. */
export async function signPaths(sb: Supabase, paths: string[]) {
  if (!paths.length) return new Map<string, string>();
  const { data } = await sb.storage.from(FILES_BUCKET).createSignedUrls(paths, 3600);
  return new Map((data ?? []).filter((d) => d.path && d.signedUrl).map((d) => [d.path!, d.signedUrl]));
}

export async function loadInspiration(sb: Supabase, weddingId: string): Promise<InspirationData> {
  const [boards, pins, comments, reactions, palette, members] = await Promise.all([
    fetchAll((f, t) => sb.from("boards").select("*").eq("wedding_id", weddingId).order("sort_order").range(f, t)),
    fetchAll((f, t) => sb.from("pins").select("*").eq("wedding_id", weddingId).order("sort_order").range(f, t)),
    fetchAll((f, t) => sb.from("pin_comments").select("*").eq("wedding_id", weddingId).order("created_at").range(f, t)),
    fetchAll((f, t) => sb.from("pin_reactions").select("pin_id, user_id").eq("wedding_id", weddingId).order("pin_id").range(f, t)),
    fetchAll((f, t) =>
      sb.from("palette_colors").select("id, hex").eq("wedding_id", weddingId).order("sort_order").range(f, t),
    ),
    sb.from("wedding_members").select("user_id, profile:profiles(full_name, email)").eq("wedding_id", weddingId),
  ]);

  const names: Record<string, string> = {};
  for (const m of members.data ?? []) names[m.user_id] = m.profile?.full_name || m.profile?.email?.split("@")[0] || "Someone";

  const signed = await signPaths(sb, pins.map((p) => p.image_path).filter((p): p is string => !!p));

  return {
    boards: boards.map((b) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      shareId: b.share_id,
      count: pins.filter((p) => p.board_id === b.id).length,
    })),
    pins: pins.map((p) => ({
      id: p.id,
      boardId: p.board_id,
      src: p.image_path ? (signed.get(p.image_path) ?? null) : p.image_url,
      external: !p.image_path,
      width: p.width,
      height: p.height,
      title: p.title,
      note: p.note,
      sourceUrl: p.source_url,
      tags: p.tags,
      status: p.status,
      budgetCategoryId: p.budget_category_id,
      vendorId: p.vendor_id,
      creditName: p.credit_name,
      creditUrl: p.credit_url,
      sortOrder: p.sort_order,
      createdAt: p.created_at,
      hearts: reactions.filter((r) => r.pin_id === p.id).map((r) => r.user_id),
      comments: comments
        .filter((c) => c.pin_id === p.id)
        .map((c) => ({ id: c.id, userId: c.user_id, name: names[c.user_id] ?? "Someone", body: c.body, createdAt: c.created_at })),
    })),
    palette,
    names,
  };
}
