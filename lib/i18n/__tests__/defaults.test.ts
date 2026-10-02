import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { starterContent, starterTexts } from "../defaults";

describe("starter texts in the reader's language", () => {
  it("shows untouched defaults in the reader's language, from any language", async () => {
    const sl = await starterTexts("sl");
    expect(sl("Ceremony")).toBe("Poročni obred");
    expect(sl("Reception")).toBe("Pogostitev");
    expect(sl("Draft your guest list")).toBe("Pripravite osnutek seznama gostov");
    expect(sl("Guests")).toBe("Gostje");
    // saved in Slovenian, read in German
    const de = await starterTexts("de");
    expect(de("Poročni obred")).not.toBe("Poročni obred");
  });

  it("leaves the couple's own texts alone", async () => {
    const sl = await starterTexts("sl");
    expect(sl("Welcome drinks at the beach")).toBe("Welcome drinks at the beach");
    expect(sl("")).toBe("");
    expect(sl(null)).toBe(null);
  });

  it("matches the database defaults (plain apostrophes, any case)", async () => {
    const en = await starterTexts("en");
    expect(en("we're getting married")).toBe("We’re getting married");
  });

  it("fills website starter texts", async () => {
    const sl = await starterTexts("sl");
    const faq = starterContent(
      "faq",
      { items: [{ id: "1", question: "Are children welcome?", answer: "Yes!" }] },
      sl,
    );
    expect((faq.items as { question: string; answer: string }[])[0]).toMatchObject({
      answer: "Yes!",
    });
    expect((faq.items as { question: string }[])[0].question).not.toBe("Are children welcome?");
  });
});
