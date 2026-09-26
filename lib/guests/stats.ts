import type { GuestView } from "./model";

export type GuestStats = {
  total: number;
  households: number;
  adults: number;
  children: number;
  infants: number;
  plusOnes: number;
  unnamedPlusOnes: number;
  bySide: { partner_a: number; partner_b: number; both: number };
  /** event id → number of guests invited */
  byEvent: Record<string, number>;
  /** guests not invited to any event */
  uninvited: number;
};

/** Headline numbers shown above the guest list. */
export function computeStats(guests: GuestView[]): GuestStats {
  const stats: GuestStats = {
    total: guests.length,
    households: new Set(guests.map((g) => g.householdId)).size,
    adults: 0,
    children: 0,
    infants: 0,
    plusOnes: 0,
    unnamedPlusOnes: 0,
    bySide: { partner_a: 0, partner_b: 0, both: 0 },
    byEvent: {},
    uninvited: 0,
  };

  for (const g of guests) {
    if (g.ageGroup === "adult") stats.adults++;
    else if (g.ageGroup === "child") stats.children++;
    else stats.infants++;

    if (g.plusOneOf) {
      stats.plusOnes++;
      if (!g.firstName && !g.lastName) stats.unnamedPlusOnes++;
    }

    stats.bySide[g.side]++;

    if (g.eventIds.length === 0) stats.uninvited++;
    for (const e of g.eventIds) stats.byEvent[e] = (stats.byEvent[e] ?? 0) + 1;
  }

  return stats;
}
