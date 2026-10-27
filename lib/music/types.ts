// What the Music page works with (shared by server and browser).
import { DO_NOT_PLAY, type DjMoment } from "./songs";

export type MusicMoment = {
  id: string;
  name: string;
  kind: string;
  scheduleItemId: string | null;
  /** "20:15", from the linked schedule item */
  time: string | null;
  hidden: boolean;
};

export type MusicSong = {
  id: string;
  momentId: string;
  title: string;
  artist: string;
  url: string | null;
  note: string | null;
  priority: "must" | "nice" | "no";
  language: string | null;
  suggestedBy: string | null;
};

export type MusicSuggestion = {
  id: string;
  title: string;
  artist: string;
  guestName: string | null;
  createdAt: string;
};

/** Moments as the DJ list needs them (visible ones, songs in order). */
export function toDjMoments(data: { moments: MusicMoment[]; songs: MusicSong[] }): DjMoment[] {
  return data.moments
    .filter((m) => !m.hidden)
    .map((m) => ({
      name: m.name,
      time: m.time,
      doNotPlay: m.kind === DO_NOT_PLAY,
      songs: data.songs.filter((s) => s.momentId === m.id),
    }));
}
