import { IntlMessageFormat } from "intl-messageformat";
import { describe, expect, it } from "vitest";
import { LOCALES } from "@/i18n/locales";
import { EN as en, PARTS } from "@/i18n/messages";
import { negotiate, resolveAppLocale, resolveGuestLocale, withFallback } from "@/i18n/resolve";
import { localizeContent, localized, pruneTranslation, translationProgress } from "../content";
import { fmtDate, fmtEventWhen, fmtMoney, fmtTime, zonedToInstant } from "../format";

describe("choosing a language", () => {
  it("reads Accept-Language, including regions and Chinese variants", () => {
    expect(negotiate("de-AT,de;q=0.9,en;q=0.8")).toBe("de");
    expect(negotiate("fr-CH, en;q=0.5")).toBe("fr");
    expect(negotiate("zh-HK,zh;q=0.9")).toBe("zh-TW");
    expect(negotiate("zh")).toBe("zh-CN");
    expect(negotiate("xx, sl;q=0.1")).toBe("sl");
    expect(negotiate("xx")).toBeNull();
    expect(negotiate("de,en", ["en", "sl"])).toBe("en");
  });

  it("guests: explicit choice > earlier choice > household > browser > couple's language", () => {
    const wedding = ["sl", "en"];
    expect(resolveGuestLocale({ asked: "ja", weddingLanguages: wedding })).toBe("ja");
    expect(resolveGuestLocale({ cookie: "de", preferred: "sl", weddingLanguages: wedding })).toBe(
      "de",
    );
    expect(resolveGuestLocale({ preferred: "it", acceptLanguage: "en", weddingLanguages: wedding })).toBe(
      "it",
    );
    expect(resolveGuestLocale({ acceptLanguage: "de-DE", weddingLanguages: wedding })).toBe("de");
    expect(resolveGuestLocale({ acceptLanguage: "xx", weddingLanguages: wedding })).toBe("sl");
    expect(resolveGuestLocale({})).toBe("en");
  });

  it("app: saved choice, then browser, then English", () => {
    expect(resolveAppLocale({ cookie: "pt", acceptLanguage: "de" })).toBe("pt");
    expect(resolveAppLocale({ acceptLanguage: "it-IT" })).toBe("it");
    expect(resolveAppLocale({ acceptLanguage: "xx" })).toBe("en");
  });

  it("falls back to English for missing texts", () => {
    const merged = withFallback(
      { rsvp: { title: "Odgovor" } } as unknown as Partial<typeof en>,
      en,
    );
    expect(merged.rsvp.title).toBe("Odgovor");
    expect(merged.rsvp.send).toBe(en.rsvp.send);
    expect(merged.site.sections.home).toBe("Home");
  });
});

describe("every language file", () => {
  // collect "a.b.c" keys of an object
  const keys = (o: object, prefix = ""): string[] =>
    Object.entries(o).flatMap(([k, v]) =>
      v && typeof v === "object" ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
    );
  // "{name}" or "{count, plural, …}" (not the words inside plural branches)
  const placeholders = (s: string) =>
    [...s.matchAll(/(?<!\b(?:zero|one|two|few|many|other|=\d+)\s*)\{(\w+)\s*[,}]/g)]
      .map((m) => m[1])
      .sort();
  const tags = (s: string) => [...s.matchAll(/<(\w+)>/g)].map((m) => m[1]).sort();
  const enKeys = keys(en);
  const get = (o: object, path: string) =>
    path.split(".").reduce<unknown>((x, k) => (x as Record<string, unknown>)?.[k], o);

  for (const { code } of LOCALES) {
    it(`${code}: same keys, placeholders and tags as English`, async () => {
      const parts = await Promise.all(
        PARTS.map(async (p) => (await import(`@/messages/${code}/${p}.json`)).default),
      );
      const messages = Object.assign({}, ...parts);
      expect(keys(messages).sort()).toEqual([...enKeys].sort());
      for (const k of enKeys) {
        const source = String(get(en, k));
        const translated = String(get(messages, k));
        expect(translated.trim(), `${code} ${k} is empty`).not.toBe("");
        // plural forms may differ, so only compare the variable names
        expect(new Set(placeholders(translated)), `${code} ${k} placeholders`).toEqual(
          new Set(placeholders(source)),
        );
        expect(tags(translated), `${code} ${k} tags`).toEqual(tags(source));
        // valid message syntax for this language (plural rules, braces, tags)
        expect(() => new IntlMessageFormat(translated, code), `${code} ${k} syntax`).not.toThrow();
      }
    });
  }
});

describe("couple's content in several languages", () => {
  const faq = {
    items: [
      { id: "a", question: "Kids?", answer: "Yes" },
      { id: "b", question: "Parking?", answer: "Free" },
    ],
  };
  const sl = {
    items: { a: { question: "Otroci?", answer: "Da" }, b: { question: "", answer: "" } },
  };
  it("uses translations where they exist, the main language elsewhere", () => {
    expect(localizeContent("faq", faq, sl).items).toEqual([
      { id: "a", question: "Otroci?", answer: "Da" },
      { id: "b", question: "Parking?", answer: "Free" },
    ]);
    expect(localizeContent("faq", faq, undefined)).toBe(faq);
  });
  it("counts what's translated", () => {
    expect(translationProgress("faq", faq, sl)).toEqual({ done: 2, total: 4 });
    expect(translationProgress("home", { tagline: "" }, undefined)).toEqual({ done: 0, total: 0 });
  });
  it("prunes empty translations", () => {
    expect(
      pruneTranslation({ intro: " ", items: { b: { question: "" }, a: { answer: "Da" } } }),
    ).toEqual({ items: { a: { answer: "Da" } } });
  });
  it("localizes rows (events, meals)", () => {
    const ev = {
      name: "Ceremony",
      dress_code: "Formal",
      translations: { sl: { name: "Poroka", dress_code: "" } },
    };
    expect(localized(ev, "sl", ["name", "dress_code"])).toMatchObject({
      name: "Poroka",
      dress_code: "Formal",
    });
    expect(localized(ev, "de", ["name"]).name).toBe("Ceremony");
  });
});

describe("local formats", () => {
  it("formats dates the way each language does", () => {
    expect(fmtDate("2027-05-24", "sl", "short")).toBe("24. 5. 2027");
    expect(fmtDate("2027-05-24", "en", "long")).toBe("May 24, 2027");
    expect(fmtDate("2027-05-24", "de", "long")).toBe("24. Mai 2027");
    expect(fmtDate("2027-05-24", "ja", "long")).toBe("2027年5月24日");
    expect(fmtDate(null, "en")).toBe("");
  });
  it("formats times and money", () => {
    expect(fmtTime("15:30:00", "de")).toBe("15:30");
    expect(fmtTime("15:30:00", "en")).toMatch(/3:30\s?PM/);
    expect(fmtMoney(1500, "EUR", "de")).toMatch(/1\.500\s?€/);
    expect(
      fmtEventWhen({ event_date: null, start_time: "15:00", end_time: null }, "en", "TBD"),
    ).toMatch(/^TBD · 3:00/);
  });
  it("converts venue time to a real moment, with daylight saving", () => {
    // 15:00 in Ljubljana in summer (UTC+2) is 13:00 UTC; in winter (UTC+1) 14:00 UTC
    expect(zonedToInstant("2027-06-12", "15:00", "Europe/Ljubljana").toISOString()).toBe(
      "2027-06-12T13:00:00.000Z",
    );
    expect(zonedToInstant("2027-01-12", "15:00", "Europe/Ljubljana").toISOString()).toBe(
      "2027-01-12T14:00:00.000Z",
    );
    expect(zonedToInstant("2027-06-12", "15:00", "America/New_York").toISOString()).toBe(
      "2027-06-12T19:00:00.000Z",
    );
  });
});
