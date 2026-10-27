// Songs for the wedding: parsing what people type, spotting duplicates, and
// the plain-text list for the DJ. Pure functions, used on server and browser.

import type { MusicPriority } from "@/lib/database.types";

/** The moments every wedding starts with, in order (names come from messages). */
export const DEFAULT_MOMENTS = [
  "ceremony_in",
  "ceremony_signing",
  "ceremony_out",
  "cocktail",
  "dinner",
  "entrance",
  "first_dance",
  "parent_dance",
  "cake",
  "party",
  "last_song",
  "do_not_play",
] as const;
export type MomentKind = (typeof DEFAULT_MOMENTS)[number] | "custom";

export const DO_NOT_PLAY = "do_not_play";

/** Songs in "Do not play" are always "do not play". */
export function priorityFor(kind: string, priority: MusicPriority): MusicPriority {
  return kind === DO_NOT_PLAY ? "no" : priority === "no" ? "nice" : priority;
}

// Query parameters that only track who shared a link.
const TRACKING =
  /^(utm_.+|si|fbclid|gclid|igshid|feature|pp|ab_channel|ls|uo|app|referral|context|nd)$/i;

/** A tidy https link, or null when it isn't a web link. Tracking bits are removed. */
export function cleanUrl(raw: string | null | undefined): string | null {
  const text = raw?.trim();
  if (!text) return null;
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".")) return null;
  u.protocol = "https:";
  for (const key of [...u.searchParams.keys()]) if (TRACKING.test(key)) u.searchParams.delete(key);
  u.hash = "";
  const out = u.toString();
  return out.length <= 500 ? out : null;
}

export type LinkKind = "spotify" | "youtube" | "apple" | "other";

export function linkKind(url: string | null | undefined): LinkKind | null {
  if (!url) return null;
  const host = (() => {
    try {
      return new URL(url).hostname.replace(/^www\.|^m\.|^music\./, "");
    } catch {
      return "";
    }
  })();
  if (host.endsWith("spotify.com") || host === "spotify.link") return "spotify";
  if (host === "youtube.com" || host === "youtu.be") return "youtube";
  if (host === "apple.com") return "apple";
  return "other";
}

const URL_IN_TEXT =
  /\b(?:https?:\/\/|www\.)\S+|\b(?:open\.spotify\.com|youtu\.be|youtube\.com|music\.apple\.com)\/\S*/i;

/**
 * What someone typed or pasted: "Etta James – At Last" (artist – title),
 * "At Last" (just a title), or a Spotify / YouTube / Apple Music link.
 * An en or em dash splits with or without spaces; a hyphen only with spaces
 * around it, so "Jay-Z" stays whole.
 */
export function parseSongInput(input: string): {
  title: string;
  artist: string;
  url: string | null;
} {
  let text = (input ?? "").replace(/\s+/g, " ").trim();
  let url: string | null = null;
  const link = text.match(URL_IN_TEXT);
  if (link) {
    url = cleanUrl(link[0]);
    text = text.replace(link[0], " ").replace(/\s+/g, " ").trim();
  }
  const unquote = (s: string) => s.replace(/^["“”„']+|["“”']+$/g, "").trim();
  const parts = text.match(/^(.+?)\s*[–—]\s*(.+)$/) ?? text.match(/^(.+?)\s+-\s+(.+)$/);
  if (parts) return { artist: unquote(parts[1]), title: unquote(parts[2]), url };
  return { title: unquote(text), artist: "", url };
}

/** "Etta James – At Last", or just the title. */
export function songLabel(s: { title: string; artist?: string | null }) {
  return s.artist?.trim() ? `${s.artist.trim()} – ${s.title.trim()}` : s.title.trim();
}

/** Compare songs ignoring case, accents, punctuation and "(feat. …)". */
export function songKey(title: string, artist = "") {
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[([](feat|ft|with)\.?[^)\]]*[)\]]/g, "")
      .replace(/&/g, " and ")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  return `${norm(title)}|${norm(artist)}`;
}

/** The first song with the same title and artist, if any. */
export function findDuplicate<T extends { id: string; title: string; artist: string }>(
  songs: T[],
  song: { title: string; artist: string },
  ignoreId?: string,
) {
  const key = songKey(song.title, song.artist);
  return songs.find((s) => s.id !== ignoreId && songKey(s.title, s.artist) === key) ?? null;
}

type KeyedSong = {
  id: string;
  title: string;
  artist: string;
  priority: MusicPriority;
  moment_id: string;
};

/** Songs marked "must play" somewhere that are also on the "do not play" list. */
export function mustAndBanned(songs: KeyedSong[], doNotPlayIds: Set<string>) {
  const banned = new Set(
    songs.filter((s) => doNotPlayIds.has(s.moment_id)).map((s) => songKey(s.title, s.artist)),
  );
  return songs.filter(
    (s) =>
      !doNotPlayIds.has(s.moment_id) &&
      s.priority === "must" &&
      banned.has(songKey(s.title, s.artist)),
  );
}

// ---------- RSVP: up to three songs, stored as text lines too ----------

export type GuestSong = { title: string; artist: string };
export const MAX_GUEST_SONGS = 3;

/** The household's songs as the one text field older parts of the app show. */
export function guestSongsToText(songs: GuestSong[]) {
  return songs
    .filter((s) => s.title.trim())
    .slice(0, MAX_GUEST_SONGS)
    .map((s) => songLabel(s).replace(/\s+/g, " "))
    .join("\n")
    .slice(0, 200);
}

/** Back from that text field to separate songs (one per line). */
export function textToGuestSongs(text: string | null | undefined): GuestSong[] {
  return (text ?? "")
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, MAX_GUEST_SONGS)
    .map((l) => {
      const p = parseSongInput(l);
      return { title: p.title, artist: p.artist };
    });
}

// ---------- the list for the DJ ----------

export type DjMoment = {
  name: string;
  /** "20:15", already formatted */
  time: string | null;
  doNotPlay: boolean;
  songs: {
    title: string;
    artist: string;
    priority: MusicPriority;
    note: string | null;
    url: string | null;
    language: string | null;
  }[];
};

export type DjLabels = {
  priority: Record<MusicPriority, string>;
  noSongs: string;
};

/** Moments in order with numbered songs; "Do not play" last. Leaves out empty moments. */
export function djMoments(moments: DjMoment[], includeNice: boolean) {
  const keep = moments
    .map((m) => ({
      ...m,
      songs: m.doNotPlay || includeNice ? m.songs : m.songs.filter((s) => s.priority === "must"),
    }))
    .filter((m) => m.songs.length > 0);
  return [...keep.filter((m) => !m.doNotPlay), ...keep.filter((m) => m.doNotPlay)];
}

/** The same list as plain text, for email or WhatsApp. */
export function buildDjText(opts: {
  heading: string[];
  moments: DjMoment[];
  includeNice: boolean;
  labels: DjLabels;
}) {
  const lines = [...opts.heading.filter(Boolean)];
  for (const m of djMoments(opts.moments, opts.includeNice)) {
    lines.push("", (m.time ? `${m.name}, ${m.time}` : m.name).toUpperCase());
    m.songs.forEach((s, i) => {
      const tags = [
        !m.doNotPlay && opts.labels.priority[s.priority],
        s.language?.trim() || null,
      ].filter(Boolean);
      lines.push(`${i + 1}. ${songLabel(s)}${tags.length ? ` (${tags.join(", ")})` : ""}`);
      if (s.note?.trim()) lines.push(`   ${s.note.trim()}`);
      if (s.url) lines.push(`   ${s.url}`);
    });
  }
  if (lines.length === opts.heading.filter(Boolean).length) lines.push("", opts.labels.noSongs);
  return lines.join("\n");
}

/** Positions after moving item `from` to `to` (for drag and the up/down buttons). */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item);
  return next;
}
