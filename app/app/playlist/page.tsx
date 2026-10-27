import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { PlaylistPage } from "@/components/playlist/playlist-page";
import { starterTexts } from "@/lib/i18n/defaults";
import { DEFAULT_CATEGORIES } from "@/lib/playlist/songs";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { canEdit, requireWedding } from "@/lib/wedding";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("playlist"))("title") };
}

export default async function Playlist() {
  const { wedding, role } = await requireWedding();
  const sb = await createClient();
  const locale = await getLocale();
  const editable = canEdit(role);
  const w = wedding.id;

  const loadCategories = () =>
    fetchAll((f, t) =>
      sb
        .from("playlist_categories")
        .select("id, name")
        .eq("wedding_id", w)
        .order("sort_order")
        .order("created_at")
        .range(f, t),
    );
  let categories = await loadCategories();

  // First visit: start with Ceremony, First dance, Dinner and Party.
  if (!categories.length && editable) {
    const t = await getTranslations("playlist.defaults");
    const { error } = await sb
      .from("playlist_categories")
      .insert(DEFAULT_CATEGORIES.map((key, i) => ({ wedding_id: w, name: t(key), sort_order: i })));
    // 23505: someone else opened the page at the same moment and made them first
    if (error && error.code !== "23505") console.error("[playlist defaults]", error);
    categories = await loadCategories();
  }

  const [songs, shown] = await Promise.all([
    fetchAll((f, t) =>
      sb
        .from("playlist_songs")
        .select("id, category_id, title, artist, priority")
        .eq("wedding_id", w)
        .order("created_at")
        .range(f, t),
    ),
    starterTexts(locale),
  ]);

  return (
    <PlaylistPage
      // Untouched default names show in each person's own language.
      categories={categories.map((c) => ({ id: c.id, name: shown(c.name, "playlist.defaults") }))}
      songs={songs}
      canEdit={editable}
    />
  );
}
