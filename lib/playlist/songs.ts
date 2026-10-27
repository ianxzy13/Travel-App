// The wedding playlist: default categories and spotting the same song twice.

import type { PlaylistPriority } from "@/lib/database.types";

/** Categories every playlist starts with (names in messages "playlist.defaults"). */
export const DEFAULT_CATEGORIES = ["ceremony", "firstDance", "dinner", "party"] as const;

export const PRIORITIES: PlaylistPriority[] = ["must", "nice", "no"];

export type PriorityFilter = "all" | PlaylistPriority;

/** Same song regardless of case, accents, spaces or punctuation. */
export function songKey(title: string, artist = "") {
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  return `${norm(title)}|${norm(artist)}`;
}

/** The first song with the same name and artist, if any (`ignoreId` = the song being edited). */
export function findDuplicate<T extends { id: string; title: string; artist: string }>(
  songs: T[],
  song: { title: string; artist: string },
  ignoreId?: string,
) {
  if (!song.title.trim()) return null;
  const key = songKey(song.title, song.artist);
  return songs.find((s) => s.id !== ignoreId && songKey(s.title, s.artist) === key) ?? null;
}

/** Songs per category, in category order, keeping only those matching the filter. */
export function groupSongs<
  C extends { id: string },
  S extends { category_id: string; priority: PlaylistPriority },
>(categories: C[], songs: S[], filter: PriorityFilter) {
  return categories.map((category) => ({
    category,
    songs: songs.filter(
      (s) => s.category_id === category.id && (filter === "all" || s.priority === filter),
    ),
  }));
}
