import { describe, expect, it } from "vitest";
import { findDuplicate, groupSongs, songKey } from "../songs";

describe("duplicates", () => {
  const songs = [
    { id: "1", title: "At Last", artist: "Etta James" },
    { id: "2", title: "Čao bela", artist: "" },
  ];
  it("ignores case, accents, spaces and punctuation", () => {
    expect(songKey("At  Last!", "ETTA JAMES")).toBe(songKey("at last", "Etta James"));
    expect(findDuplicate(songs, { title: "at last", artist: "etta james" })?.id).toBe("1");
    expect(findDuplicate(songs, { title: "Cao Bela", artist: "" })?.id).toBe("2");
  });
  it("needs the same artist too", () => {
    expect(findDuplicate(songs, { title: "At Last", artist: "Beyoncé" })).toBeNull();
  });
  it("skips the song being edited and empty names", () => {
    expect(findDuplicate(songs, { title: "At Last", artist: "Etta James" }, "1")).toBeNull();
    expect(findDuplicate(songs, { title: "  ", artist: "" })).toBeNull();
  });
});

describe("groupSongs", () => {
  const cats = [{ id: "a" }, { id: "b" }];
  const songs = [
    { id: "1", category_id: "a", priority: "must" as const },
    { id: "2", category_id: "b", priority: "nice" as const },
    { id: "3", category_id: "a", priority: "no" as const },
  ];
  it("keeps category order and filters by priority", () => {
    expect(groupSongs(cats, songs, "all").map((g) => g.songs.length)).toEqual([2, 1]);
    expect(groupSongs(cats, songs, "must").map((g) => g.songs.map((s) => s.id))).toEqual([
      ["1"],
      [],
    ]);
  });
});
