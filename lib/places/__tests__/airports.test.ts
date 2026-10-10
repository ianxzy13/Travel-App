import { describe, expect, it } from "vitest";
import { searchAirports, airportByCode } from "../airports";

function codes(results: { code: string }[]) {
  return results.map((r) => r.code);
}

describe("searchAirports", () => {
  it("returns empty for 1-char query", async () => {
    expect(await searchAirports("L")).toEqual([]);
  });

  it("returns empty for gibberish", async () => {
    expect(await searchAirports("xyzqwfoo")).toEqual([]);
  });

  it("LJ → LJU in results", async () => {
    const results = await searchAirports("LJ");
    expect(codes(results)).toContain("LJU");
  });

  it("Ljub → LJU first", async () => {
    const results = await searchAirports("Ljub");
    expect(results[0].code).toBe("LJU");
  });

  it("brnik → LJU (keyword match)", async () => {
    const results = await searchAirports("brnik");
    expect(codes(results)).toContain("LJU");
  });

  it("pucnik → LJU (accent-insensitive)", async () => {
    const results = await searchAirports("pucnik");
    expect(codes(results)).toContain("LJU");
  });

  it("zag → ZAG first", async () => {
    const results = await searchAirports("zag");
    expect(results[0].code).toBe("ZAG");
  });

  it("MCO → MCO first (exact code)", async () => {
    const results = await searchAirports("MCO");
    expect(results[0].code).toBe("MCO");
  });

  it("orlando → MCO first", async () => {
    const results = await searchAirports("orlando");
    expect(results[0].code).toBe("MCO");
  });

  it("zurich → ZRH (accent-insensitive)", async () => {
    const results = await searchAirports("zurich");
    expect(codes(results)).toContain("ZRH");
  });

  it("multi-word: venice marco → VCE", async () => {
    const results = await searchAirports("venice marco");
    expect(codes(results)).toContain("VCE");
  });

  it("respects limit", async () => {
    const results = await searchAirports("london", { limit: 3 });
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it("case insensitive: lju = LJU", async () => {
    const results = await searchAirports("lju");
    expect(results[0].code).toBe("LJU");
  });
});

describe("airportByCode", () => {
  it("returns airport for valid code", async () => {
    const a = await airportByCode("LJU");
    expect(a).toBeDefined();
    expect(a!.code).toBe("LJU");
    expect(a!.city).toBeTruthy();
  });

  it("returns undefined for invalid code", async () => {
    expect(await airportByCode("ZZZ")).toBeUndefined();
  });
});
