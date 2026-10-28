import { describe, expect, it } from "vitest";
import { toSlovenianYou } from "../slovenian-you";

describe("Slovenian: speaking to one guest or two", () => {
  it("one guest: ti", () => {
    expect(toSlovenianYou("Komaj čakava, da vas vidiva!", "one")).toBe(
      "Komaj čakava, da te vidiva!",
    );
    expect(toSlovenianYou("Prosiva, sporočite nama, ali pridete.", "one")).toBe(
      "Prosiva, sporoči nama, ali prideš.",
    );
    expect(toSlovenianYou("Veseliva se praznovanja z vami.", "one")).toBe(
      "Veseliva se praznovanja s tabo.",
    );
    expect(toSlovenianYou("To je za vas. Vaša miza je pripravljena.", "one")).toBe(
      "To je za tebe. Tvoja miza je pripravljena.",
    );
    expect(toSlovenianYou("Ali veste, kje boste spali?", "one")).toBe(
      "Ali veste, kje boste spali?",
    ); // spal/spala
    expect(toSlovenianYou("Ali veste, kje je hotel? Boste z nama?", "one")).toBe(
      "Ali veš, kje je hotel? Boš z nama?",
    );
  });

  it("one guest: stays polite plural when the singular needs a gender", () => {
    const text = "Hvala, ker ste prišli. Dobrodošli!";
    expect(toSlovenianYou(text, "one")).toBe(text);
  });

  it("two guests: vidva", () => {
    expect(toSlovenianYou("Komaj čakava, da vas vidiva!", "two")).toBe(
      "Komaj čakava, da vaju vidiva!",
    );
    expect(toSlovenianYou("Hvala, ker ste prišli. Dobrodošli!", "two")).toBe(
      "Hvala, ker sta prišla. Dobrodošla!",
    );
    expect(toSlovenianYou("Prosiva, sporočite nama, ali pridete z vašimi otroki.", "two")).toBe(
      "Prosiva, sporočita nama, ali prideta z vajinimi otroki.",
    );
  });

  it("three or more: unchanged", () => {
    expect(toSlovenianYou("Komaj čakava, da vas vidiva!", "other")).toBe(
      "Komaj čakava, da vas vidiva!",
    );
  });
});
