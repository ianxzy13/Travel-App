import { describe, expect, it } from "vitest";
import {
  buildDjText,
  cleanUrl,
  findDuplicate,
  guestSongsToText,
  linkKind,
  moveItem,
  mustAndBanned,
  parseSongInput,
  priorityFor,
  songKey,
  textToGuestSongs,
  type DjMoment,
} from "../songs";

describe("parseSongInput", () => {
  it("splits artist and title on an en dash or a spaced hyphen", () => {
    expect(parseSongInput("Etta James – At Last")).toEqual({
      artist: "Etta James",
      title: "At Last",
      url: null,
    });
    expect(parseSongInput("Etta James - At Last")).toMatchObject({ artist: "Etta James" });
    expect(parseSongInput("Etta James—At Last")).toMatchObject({ title: "At Last" });
  });
  it("cleans up extra spaces and quotes", () => {
    expect(parseSongInput('   Etta   James  -   "At  Last"  ')).toEqual({
      artist: "Etta James",
      title: "At Last",
      url: null,
    });
  });
  it("keeps hyphenated names whole", () => {
    expect(parseSongInput("Jay-Z")).toEqual({ title: "Jay-Z", artist: "", url: null });
    expect(parseSongInput("Jay-Z - Empire State of Mind")).toMatchObject({ artist: "Jay-Z" });
  });
  it("takes links out and drops tracking parameters", () => {
    const p = parseSongInput("https://open.spotify.com/track/abc123?si=XYZ&utm_source=copy");
    expect(p).toEqual({ title: "", artist: "", url: "https://open.spotify.com/track/abc123" });
    const y = parseSongInput(
      "At Last https://www.youtube.com/watch?v=S-cbOl96RFM&feature=share&t=30",
    );
    expect(y.title).toBe("At Last");
    expect(y.url).toBe("https://www.youtube.com/watch?v=S-cbOl96RFM&t=30");
  });
  it("handles empty input", () => {
    expect(parseSongInput("")).toEqual({ title: "", artist: "", url: null });
    expect(parseSongInput("   ")).toEqual({ title: "", artist: "", url: null });
  });
});

describe("links", () => {
  it("only accepts web links and makes them https", () => {
    expect(cleanUrl("http://youtu.be/abc?si=1")).toBe("https://youtu.be/abc");
    expect(cleanUrl("javascript:alert(1)")).toBeNull();
    expect(cleanUrl("not a link")).toBeNull();
    expect(cleanUrl("")).toBeNull();
  });
  it("knows the music services", () => {
    expect(linkKind("https://open.spotify.com/track/1")).toBe("spotify");
    expect(linkKind("https://youtu.be/1")).toBe("youtube");
    expect(linkKind("https://music.apple.com/si/album/1")).toBe("apple");
    expect(linkKind("https://example.com")).toBe("other");
    expect(linkKind(null)).toBeNull();
  });
});

describe("duplicates", () => {
  const songs = [
    { id: "1", title: "Šank Rock – Pridi", artist: "" },
    { id: "2", title: "At Last", artist: "Etta James" },
  ];
  it("ignores case, accents, punctuation and featuring", () => {
    expect(songKey("At Last!", "ETTA JAMES")).toBe(songKey("at last", "Etta James"));
    expect(songKey("Hello (feat. Someone)", "A")).toBe(songKey("Hello", "a"));
    expect(findDuplicate(songs, { title: "at last", artist: "etta james" })?.id).toBe("2");
    expect(findDuplicate(songs, { title: "at last", artist: "etta james" }, "2")).toBeNull();
    expect(findDuplicate(songs, { title: "sank rock – pridi", artist: "" })?.id).toBe("1");
  });
  it("finds must-play songs that are also banned", () => {
    const list = [
      {
        id: "a",
        title: "Macarena",
        artist: "Los del Río",
        priority: "must" as const,
        moment_id: "party",
      },
      {
        id: "b",
        title: "macarena",
        artist: "Los del Rio",
        priority: "no" as const,
        moment_id: "dnp",
      },
      { id: "c", title: "At Last", artist: "", priority: "must" as const, moment_id: "dance" },
    ];
    expect(mustAndBanned(list, new Set(["dnp"])).map((s) => s.id)).toEqual(["a"]);
  });
  it("forces do-not-play priority", () => {
    expect(priorityFor("do_not_play", "must")).toBe("no");
    expect(priorityFor("party", "no")).toBe("nice");
    expect(priorityFor("party", "must")).toBe("must");
  });
});

describe("guest songs on the RSVP", () => {
  it("round-trips through the text field", () => {
    const songs = [
      { title: "At Last", artist: "Etta James" },
      { title: "Pridi", artist: "" },
      { title: "  ", artist: "x" },
    ];
    const text = guestSongsToText(songs);
    expect(text).toBe("Etta James – At Last\nPridi");
    expect(textToGuestSongs(text)).toEqual(songs.slice(0, 2));
    expect(textToGuestSongs(null)).toEqual([]);
  });
});

describe("DJ list", () => {
  const moments: DjMoment[] = [
    {
      name: "Do not play",
      time: null,
      doNotPlay: true,
      songs: [
        { title: "Macarena", artist: "", priority: "no", note: null, url: null, language: null },
      ],
    },
    {
      name: "First dance",
      time: "20:15",
      doNotPlay: false,
      songs: [
        {
          title: "At Last",
          artist: "Etta James",
          priority: "must",
          note: "fade out at 2:30",
          url: null,
          language: "EN",
        },
        { title: "Nice one", artist: "", priority: "nice", note: null, url: null, language: null },
      ],
    },
    { name: "Dinner", time: null, doNotPlay: false, songs: [] },
  ];
  const labels = {
    priority: { must: "must play", nice: "would be nice", no: "do not play" },
    noSongs: "No songs yet",
  };

  it("numbers songs, adds notes, and puts Do not play last", () => {
    const text = buildDjText({ heading: ["Ana & Marko"], moments, includeNice: true, labels });
    expect(text).toBe(
      [
        "Ana & Marko",
        "",
        "FIRST DANCE, 20:15",
        "1. Etta James – At Last (must play, EN)",
        "   fade out at 2:30",
        "2. Nice one (would be nice)",
        "",
        "DO NOT PLAY",
        "1. Macarena",
      ].join("\n"),
    );
  });
  it("can leave out would-be-nice songs", () => {
    expect(buildDjText({ heading: [], moments, includeNice: false, labels })).not.toContain(
      "Nice one",
    );
    expect(buildDjText({ heading: ["X"], moments: [], includeNice: true, labels })).toBe(
      "X\n\nNo songs yet",
    );
  });
  it("moves items", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b"], 1, 1)).toEqual(["a", "b"]);
  });
});
