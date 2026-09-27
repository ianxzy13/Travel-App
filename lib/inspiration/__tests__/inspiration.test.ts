import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { cleanTags, extractPalette, masonryColumns, orderBetween, textOn } from "../layout";
import { isPrivateIp, parseOpenGraph } from "../link-preview";

describe("masonry", () => {
  it("puts each item in the shortest column", () => {
    const items = [
      { id: "tall", width: 100, height: 300 },
      { id: "a", width: 100, height: 100 },
      { id: "b", width: 100, height: 100 },
      { id: "c", width: 100, height: 100 },
    ];
    const cols = masonryColumns(items, 2).map((c) => c.map((i) => i.id));
    expect(cols).toEqual([["tall"], ["a", "b", "c"]]);
  });

  it("copes with unknown sizes and one column", () => {
    expect(masonryColumns([{ width: null, height: null }], 1)).toHaveLength(1);
  });
});

describe("ordering and tags", () => {
  it("finds a value between neighbours", () => {
    expect(orderBetween(1, 2)).toBe(1.5);
    expect(orderBetween(null, 5)).toBe(4);
    expect(orderBetween(5, null)).toBe(6);
    expect(orderBetween(null, null)).toBe(0);
  });

  it("cleans tags", () => {
    expect(cleanTags(" Peonies, #blush ,peonies,, ")).toEqual(["peonies", "blush"]);
  });
});

describe("palette", () => {
  it("finds dominant, distinct colours and ignores transparent pixels", () => {
    const px: number[] = [];
    const add = (r: number, g: number, b: number, n: number, a = 255) => {
      for (let i = 0; i < n; i++) px.push(r, g, b, a);
    };
    add(250, 240, 230, 60); // ivory (most)
    add(200, 120, 130, 30); // dusty rose
    add(251, 241, 231, 20); // almost the same ivory: merged away
    add(90, 110, 80, 10); // sage
    add(0, 0, 255, 50, 0); // transparent blue: ignored
    const palette = extractPalette(px, 5);
    expect(palette).toHaveLength(3);
    expect(palette[0]).toMatch(/^#f[0-9a-f]{5}$/);
    expect(palette).toContain("#c87882");
  });

  it("picks readable text colours", () => {
    expect(textOn("#ffffff")).toBe("#1c1917");
    expect(textOn("#1d3557")).toBe("#ffffff");
  });
});

describe("link preview safety", () => {
  it("blocks private and internal addresses", () => {
    for (const ip of [
      "127.0.0.1",
      "10.1.2.3",
      "172.20.0.1",
      "192.168.1.1",
      "169.254.169.254",
      "0.0.0.0",
      "100.64.0.1",
      "::1",
      "fd00::1",
      "fe80::1",
      "::ffff:127.0.0.1",
    ]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
    for (const ip of ["8.8.8.8", "151.101.1.140", "2606:4700::6810:84e5"])
      expect(isPrivateIp(ip), ip).toBe(false);
  });

  it("reads Open Graph images and titles, resolving relative URLs", () => {
    const html = `<html><head><title>Fallback</title>
      <meta content="/img/arch.jpg" property="og:image">
      <meta property="og:title" content="Floral arch &amp; aisle"></head></html>`;
    expect(parseOpenGraph(html, "https://blog.example.com/post/1")).toEqual({
      image: "https://blog.example.com/img/arch.jpg",
      title: "Floral arch & aisle",
    });
    expect(parseOpenGraph("<title>Only title</title>", "https://x.com").title).toBe("Only title");
    expect(parseOpenGraph("<p>nothing</p>", "https://x.com").image).toBeNull();
  });
});
