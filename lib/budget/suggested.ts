/**
 * Suggested budget categories with a typical share of the total (sums to 100%).
 * Only a starting point: couples can rename, delete and re-allocate freely.
 */
export const SUGGESTED_CATEGORIES = [
  { key: "venue", name: "Venue", percent: 20 },
  { key: "catering", name: "Catering", percent: 25 },
  { key: "photography", name: "Photography", percent: 10 },
  { key: "videography", name: "Videography", percent: 5 },
  { key: "attire", name: "Attire", percent: 7 },
  { key: "flowers", name: "Flowers", percent: 6 },
  { key: "music", name: "Music / DJ", percent: 5 },
  { key: "decor", name: "Decor", percent: 4 },
  { key: "stationery", name: "Stationery", percent: 2 },
  { key: "rings", name: "Rings", percent: 3 },
  { key: "beauty", name: "Hair & Makeup", percent: 2 },
  { key: "transport", name: "Transportation", percent: 2 },
  { key: "accommodation", name: "Accommodation", percent: 2 },
  { key: "favors", name: "Favors", percent: 1 },
  { key: "honeymoon", name: "Honeymoon", percent: 4 },
  { key: "misc", name: "Miscellaneous", percent: 2 },
] as const;
export type SuggestedKey = (typeof SUGGESTED_CATEGORIES)[number]["key"];

/**
 * Splits a total across the suggested categories, rounding to whole units.
 * Any rounding difference goes to the largest category so the parts add up.
 */
export function suggestedAllocations(
  total: number | null,
  /** the category names in the couple's language (English by default) */
  nameOf: (key: SuggestedKey) => string = (k) =>
    SUGGESTED_CATEGORIES.find((c) => c.key === k)!.name,
) {
  if (!total || total <= 0)
    return SUGGESTED_CATEGORIES.map((c) => ({ name: nameOf(c.key), allocated: 0 }));
  const parts = SUGGESTED_CATEGORIES.map((c) => ({
    name: nameOf(c.key),
    allocated: Math.floor((total * c.percent) / 100),
  }));
  const diff = Math.round(total - parts.reduce((n, p) => n + p.allocated, 0));
  const biggest = parts.reduce((best, p, i) => (p.allocated > parts[best].allocated ? i : best), 0);
  parts[biggest].allocated += diff;
  return parts;
}

/** Badge colours per vendor status (labels are in messages "vendors.statuses"). */
export const VENDOR_STATUS_CLASSES = {
  researching: "bg-muted text-muted-foreground",
  contacted: "bg-tint-mist text-tint-mist-fg",
  quoted: "bg-tint-sand text-tint-sand-fg",
  booked: "bg-tint-sage text-tint-sage-fg",
  rejected: "bg-muted text-muted-foreground line-through",
} as const;
