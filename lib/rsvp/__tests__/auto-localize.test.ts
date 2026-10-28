import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: <T>(fn: T) => fn }));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const { autoTranslateRsvp } = await import("../auto-localize");

const google = (text: string) =>
  new Response(JSON.stringify([[[text, "original"]]]), { status: 200 });

const data = {
  wedding: {
    rsvp_welcome: "We can't wait!",
    rsvp_thanks: "Thank you!",
    rsvp_sorry: null,
    rsvp_contact: "",
  },
} as never;

describe("machine translation of the couple's RSVP texts", () => {
  it("translates texts without a saved translation and keeps the originals", async () => {
    fetchMock.mockReset().mockImplementation(async () => google("¡Qué ganas!"));
    const extras = {
      languages: ["en", "es"],
      translations: { es: { rsvp_thanks: "¡Gracias de corazón!" } },
    } as never;
    const saved = {
      ...(data as { wedding: object }),
      wedding: { ...(data as { wedding: object }).wedding, rsvp_thanks: "¡Gracias de corazón!" },
    } as never;
    const out = await autoTranslateRsvp(saved, extras, "es");
    expect(out.data.wedding.rsvp_welcome).toBe("¡Qué ganas!");
    expect(out.data.wedding.rsvp_thanks).toBe("¡Gracias de corazón!"); // couple's own wins
    expect(out.originals).toEqual({ rsvp_welcome: "We can't wait!" });
    expect(fetchMock).toHaveBeenCalledTimes(1); // empty texts are not sent
  });

  it("falls back to another translator, then to the original text", async () => {
    fetchMock
      .mockReset()
      .mockImplementationOnce(async () => new Response("", { status: 302 }))
      .mockImplementationOnce(
        async () =>
          new Response(
            JSON.stringify({
              responseStatus: 200,
              responseData: { translatedText: "Komaj čakamo!" },
            }),
          ),
      )
      .mockImplementation(async () => new Response("", { status: 500 }));
    const one = await autoTranslateRsvp(
      { wedding: { rsvp_welcome: "We can't wait!" } } as never,
      { languages: ["en"] } as never,
      "sl",
    );
    expect(one.data.wedding.rsvp_welcome).toBe("Komaj čakamo!");

    const none = await autoTranslateRsvp(
      { wedding: { rsvp_welcome: "We can't wait!" } } as never,
      { languages: ["en"] } as never,
      "sl",
    );
    expect(none.data.wedding.rsvp_welcome).toBe("We can't wait!");
    expect(none.originals).toEqual({});
  });

  it("shows nothing as translated when the text is already in that language", async () => {
    fetchMock.mockReset().mockImplementation(async () => google("We can't wait!"));
    const out = await autoTranslateRsvp(
      { wedding: { rsvp_welcome: "We can't wait!" } } as never,
      { languages: ["en"] } as never,
      "en",
    );
    expect(out.originals).toEqual({});
  });
});
