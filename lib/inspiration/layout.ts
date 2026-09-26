// Pure helpers for the inspiration grid (unit-tested).

/**
 * Masonry: puts each item in the currently shortest column (by summed
 * height ÷ width), so the grid stays balanced and roughly keeps its order
 * left-to-right. Items without a size count as 4:5 portrait.
 */
export function masonryColumns<T extends { width: number | null; height: number | null }>(items: T[], columns: number): T[][] {
  const cols: T[][] = Array.from({ length: Math.max(1, columns) }, () => []);
  const heights = cols.map(() => 0);
  for (const item of items) {
    const ratio = item.width && item.height ? item.height / item.width : 1.25;
    let target = 0;
    for (let i = 1; i < heights.length; i++) if (heights[i] < heights[target] - 1e-9) target = i;
    cols[target].push(item);
    // + a little for the caption/gap so text-heavy pins also balance
    heights[target] += ratio + 0.15;
  }
  return cols;
}

/**
 * Fractional ordering: a value between two neighbours so a moved pin can be
 * saved with ONE update. `before`/`after` are the sort values around the drop spot.
 */
export function orderBetween(before: number | null, after: number | null) {
  if (before == null && after == null) return 0;
  if (before == null) return (after as number) - 1;
  if (after == null) return before + 1;
  return (before + after) / 2;
}

/** Normalises free-text tags: trimmed, lower-case, unique, max 20. */
export function cleanTags(input: string[] | string) {
  const list = Array.isArray(input) ? input : input.split(",");
  return [...new Set(list.map((t) => t.trim().toLowerCase().replace(/^#/, "")).filter(Boolean))]
    .map((t) => t.slice(0, 40))
    .slice(0, 20);
}

// ---------------------------------------------------------------------------
// Colour palette
// ---------------------------------------------------------------------------

const toHex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

const distance = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/**
 * Dominant colours from RGBA pixel data (e.g. a 64×64 canvas).
 * 1. Round every pixel into a coarse colour box (5 bits per channel → 32 levels),
 *    skipping transparent pixels.
 * 2. Take the most common boxes, averaging the real pixels in each.
 * 3. Drop colours too close to one already chosen, so the palette is varied.
 */
export function extractPalette(pixels: Uint8ClampedArray | number[], count = 5): string[] {
  const boxes = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const box = boxes.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    box.n++;
    box.r += r;
    box.g += g;
    box.b += b;
    boxes.set(key, box);
  }
  const ranked = [...boxes.values()].sort((a, b) => b.n - a.n).map((x) => [x.r / x.n, x.g / x.n, x.b / x.n]);
  const chosen: number[][] = [];
  for (const c of ranked) {
    if (chosen.every((p) => distance(p, c) > 40)) chosen.push(c);
    if (chosen.length === count) break;
  }
  return chosen.map(([r, g, b]) => toHex(r, g, b));
}

/** Black or white text, whichever is readable on the given colour. */
export function textOn(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return lum > 0.4 ? "#1c1917" : "#ffffff";
}
