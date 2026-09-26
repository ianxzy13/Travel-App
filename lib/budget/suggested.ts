/**
 * Suggested budget categories with a typical share of the total (sums to 100%).
 * Only a starting point: couples can rename, delete and re-allocate freely.
 */
export const SUGGESTED_CATEGORIES: { name: string; percent: number }[] = [
  { name: "Venue", percent: 20 },
  { name: "Catering", percent: 25 },
  { name: "Photography", percent: 10 },
  { name: "Videography", percent: 5 },
  { name: "Attire", percent: 7 },
  { name: "Flowers", percent: 6 },
  { name: "Music / DJ", percent: 5 },
  { name: "Decor", percent: 4 },
  { name: "Stationery", percent: 2 },
  { name: "Rings", percent: 3 },
  { name: "Hair & Makeup", percent: 2 },
  { name: "Transportation", percent: 2 },
  { name: "Accommodation", percent: 2 },
  { name: "Favors", percent: 1 },
  { name: "Honeymoon", percent: 4 },
  { name: "Miscellaneous", percent: 2 },
];

/**
 * Splits a total across the suggested categories, rounding to whole units.
 * Any rounding difference goes to the largest category so the parts add up.
 */
export function suggestedAllocations(total: number | null) {
  if (!total || total <= 0)
    return SUGGESTED_CATEGORIES.map((c) => ({ name: c.name, allocated: 0 }));
  const parts = SUGGESTED_CATEGORIES.map((c) => ({
    name: c.name,
    allocated: Math.floor((total * c.percent) / 100),
  }));
  const diff = Math.round(total - parts.reduce((n, p) => n + p.allocated, 0));
  const biggest = parts.reduce((best, p, i) => (p.allocated > parts[best].allocated ? i : best), 0);
  parts[biggest].allocated += diff;
  return parts;
}

export const VENDOR_STATUSES = {
  researching: { label: "Researching", className: "bg-muted text-muted-foreground" },
  contacted: {
    label: "Contacted",
    className: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  },
  quoted: {
    label: "Quote received",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  },
  booked: {
    label: "Booked",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  },
  rejected: { label: "Not chosen", className: "bg-muted text-muted-foreground line-through" },
} as const;
