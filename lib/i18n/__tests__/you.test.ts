import { describe, expect, it } from "vitest";
import { pickYou, pickYouAll, youForm } from "@/i18n/you";

describe("speaking to one guest, two or more", () => {
  const sl = "{you, select, one {Ali prideš?} two {Ali prideta?} other {Ali pridete?}} Hvala!";

  it("picks by household size", () => {
    expect(youForm(1)).toBe("one");
    expect(youForm(2)).toBe("two");
    expect(youForm(5)).toBe("other");
    expect(youForm(undefined)).toBe("other");
    expect(pickYou(sl, "one")).toBe("Ali prideš? Hvala!");
    expect(pickYou(sl, "two")).toBe("Ali prideta? Hvala!");
    expect(pickYou(sl, "other")).toBe("Ali pridete? Hvala!");
  });

  it("uses the plural where a language has no dual, and keeps other placeholders", () => {
    const de = "{you, select, one {Kannst du, {name}?} other {Könnt ihr, {name}?}}";
    expect(pickYou(de, "two")).toBe("Könnt ihr, {name}?");
    expect(pickYou(de, "one")).toBe("Kannst du, {name}?");
    const plural = "{count, plural, one {# {you, select, one {tvoj} other {vaš}}} other {#}}";
    expect(pickYou(plural, "one")).toBe("{count, plural, one {# tvoj} other {#}}");
  });

  it("goes through all texts and leaves the rest untouched", () => {
    const m = { a: { b: sl, c: "Plain" }, d: "Plain" };
    const out = pickYouAll(m, "two");
    expect(out.a.b).toBe("Ali prideta? Hvala!");
    expect(out.d).toBe("Plain");
    expect(pickYouAll({ x: "Plain" }, "one")).toEqual({ x: "Plain" });
  });
});
