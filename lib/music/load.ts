import "server-only";
import { getTranslations } from "next-intl/server";
import type { WeddingRow } from "@/lib/database.types";
import { starterTexts } from "@/lib/i18n/defaults";
import { fmtTime } from "@/lib/i18n/format";
import { sortByTime } from "@/lib/schedule/time";
import { fetchAll } from "@/lib/supabase/fetch-all";
import type { createClient } from "@/lib/supabase/server";
import { DEFAULT_MOMENTS } from "./songs";
import type { MusicMoment, MusicSong, MusicSuggestion } from "./types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Creates the standard moments the first time someone who can edit opens Music. */
async function ensureMoments(sb: Supabase, weddingId: string) {
  const t = await getTranslations("music.moments");
  const { error } = await sb.from("music_moments").insert(
    DEFAULT_MOMENTS.map((kind, i) => ({
      wedding_id: weddingId,
      kind,
      name: t(kind),
      sort_order: i,
    })),
  );
  // 23505: someone else opened the page at the same moment and made them first
  if (error && error.code !== "23505") console.error("[music defaults]", error);
}

export async function loadMusic(
  sb: Supabase,
  wedding: Pick<WeddingRow, "id" | "wedding_date">,
  locale: string,
  canCreate: boolean,
) {
  const w = wedding.id;
  const moments = () =>
    fetchAll((f, t) =>
      sb
        .from("music_moments")
        .select("*")
        .eq("wedding_id", w)
        .order("sort_order")
        .order("created_at")
        .range(f, t),
    );
  let momentRows = await moments();
  if (!momentRows.length && canCreate) {
    await ensureMoments(sb, w);
    momentRows = await moments();
  }

  const [songRows, suggestionRows, scheduleRows, vendorRows, categories, shown] = await Promise.all(
    [
      fetchAll((f, t) =>
        sb
          .from("music_songs")
          .select("*")
          .eq("wedding_id", w)
          .order("sort_order")
          .order("created_at")
          .range(f, t),
      ),
      fetchAll((f, t) =>
        sb
          .from("music_suggestions")
          .select("*")
          .eq("wedding_id", w)
          .order("created_at", { ascending: false })
          .range(f, t),
      ),
      fetchAll((f, t) =>
        sb
          .from("schedule_items")
          .select("id, day, start_time, duration_min, title")
          .eq("wedding_id", w)
          .range(f, t),
      ),
      fetchAll((f, t) =>
        sb
          .from("vendors")
          .select("id, name, category_id")
          .eq("wedding_id", w)
          .order("name")
          .range(f, t),
      ),
      fetchAll((f, t) =>
        sb.from("budget_categories").select("id, name").eq("wedding_id", w).range(f, t),
      ),
      starterTexts(locale),
    ],
  );

  const schedule = sortByTime(scheduleRows).map((s) => ({
    id: s.id,
    time: fmtTime(s.start_time, locale),
    day: s.day && s.day !== wedding.wedding_date ? s.day : null,
    title: shown(s.title, "schedule.template"),
  }));
  const timeOf = new Map(schedule.map((s) => [s.id, s.time]));
  const guestOf = new Map(suggestionRows.map((s) => [s.id, s.guest_name]));

  // DJ / band first: vendors in a music budget category.
  const musicCats = new Set(
    categories.filter((c) => /music|dj|band|glasb/i.test(c.name)).map((c) => c.id),
  );
  const vendors = [...vendorRows]
    .sort(
      (a, b) =>
        Number(musicCats.has(b.category_id ?? "")) - Number(musicCats.has(a.category_id ?? "")),
    )
    .map((v) => ({ id: v.id, name: v.name, music: musicCats.has(v.category_id ?? "") }));

  return {
    moments: momentRows.map((m): MusicMoment => ({
      id: m.id,
      name: m.kind === "custom" ? m.name : shown(m.name, "music.moments"),
      kind: m.kind,
      scheduleItemId: m.schedule_item_id,
      time: m.schedule_item_id ? (timeOf.get(m.schedule_item_id) ?? null) : null,
      hidden: m.hidden,
    })),
    songs: songRows.map((s): MusicSong => ({
      id: s.id,
      momentId: s.moment_id,
      title: s.title,
      artist: s.artist,
      url: s.url,
      note: s.note,
      priority: s.priority,
      language: s.language,
      suggestedBy: s.suggestion_id ? (guestOf.get(s.suggestion_id) ?? null) : null,
    })),
    suggestions: suggestionRows
      .filter((s) => s.status === "new")
      .map((s): MusicSuggestion => ({
        id: s.id,
        title: s.title,
        artist: s.artist,
        guestName: s.guest_name,
        createdAt: s.created_at,
      })),
    schedule,
    vendors,
  };
}

export type MusicData = Awaited<ReturnType<typeof loadMusic>>;
