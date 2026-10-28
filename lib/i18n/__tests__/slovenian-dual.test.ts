import { describe, expect, it } from "vitest";
import { toSlovenianDual } from "../slovenian-dual";

describe("Slovenian dual for the couple's texts", () => {
  it.each([
    ["Poročili se bomo!", "Poročila se bova!"],
    ["Komaj čakamo, da praznujemo z vami!", "Komaj čakava, da praznujeva z vami!"],
    ["Prosimo, sporočite nam, ali lahko pridete.", "Prosiva, sporočite nama, ali lahko pridete."],
    ["Hvala! Zelo smo veseli, da boste z nami.", "Hvala! Zelo sva vesela, da boste z nama."],
    [
      "Pogrešali vas bomo! Hvala, da ste nam sporočili.",
      "Pogrešala vas bova! Hvala, da ste nama sporočili.",
    ],
    ["Veselimo se našega velikega dne.", "Veseliva se najinega velikega dne."],
    ["Zelo smo hvaležni.", "Zelo sva hvaležna."],
    ["Smo se odločili za poroko na Bledu.", "Sva se odločila za poroko na Bledu."],
    ["Zelo bi bili veseli, če bi prišli.", "Zelo bi bila vesela, če bi prišli."],
  ])("%s", (input, expected) => {
    expect(toSlovenianDual(input)).toBe(expected);
  });

  it("leaves 'you', 'let's' and everyone-together forms alone", () => {
    for (const text of [
      "Vidimo se kmalu!",
      "Praznujmo skupaj!",
      "Pišite Mariji na +351 912 345 678",
      "Ali lahko pridete?",
      "Ali bi lahko prišli?",
      "Če bi radi ostali dlje, pišite.",
      "Bomo na poročni zabavi v šoli.",
    ])
      expect(toSlovenianDual(text)).toBe(text.replace(/\bBomo\b/, "Bova"));
  });
});
