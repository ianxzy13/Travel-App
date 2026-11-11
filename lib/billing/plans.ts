// What each plan includes. Pure code, safe in the browser and on the server.
// Change a limit here and every check in the app follows.
import type { PlanName } from "@/lib/database.types";

export type { PlanName };

/** Things the free plan limits or leaves out. */
export type Feature =
  | "unlimitedGuests" // more than FREE_LIMITS.guests guests
  | "sms" // texting guests (costs real money per message)
  | "exports" // Excel/CSV downloads of guests, budget, playlist
  | "seatingScenarios" // more than one version of the seating chart
  | "shuttles" // shuttle planner and its print-out
  | "noBranding" // no "Made with Vow" on the wedding website
  | "manyWeddings"; // owning more than one wedding (planners)

// Languages are never limited: guests reading Vow in their own language is the point of Vow.
export const FREE_LIMITS = { guests: 75, weddings: 1 } as const;

const PLUS: Feature[] = [
  "unlimitedGuests",
  "sms",
  "exports",
  "seatingScenarios",
  "shuttles",
  "noBranding",
];

const INCLUDED: Record<PlanName, ReadonlySet<Feature>> = {
  free: new Set(),
  plus: new Set(PLUS),
  pro: new Set<Feature>([...PLUS, "manyWeddings"]),
};

/** Is this feature part of the plan? */
export function planAllows(plan: PlanName, feature: Feature): boolean {
  return INCLUDED[plan].has(feature);
}

/** The cheapest plan that has the feature (what to offer in the upgrade note). */
export function planFor(feature: Feature): Exclude<PlanName, "free"> {
  return INCLUDED.plus.has(feature) ? "plus" : "pro";
}

/**
 * Until payments are switched on (NEXT_PUBLIC_BILLING_ENABLED=true), every
 * wedding keeps everything, so nothing changes for people already using Vow.
 */
export function effectivePlan(
  billingEnabled: boolean,
  plan: PlanName | null | undefined,
): PlanName {
  if (!billingEnabled) return "pro";
  return plan ?? "free";
}

/** Products people can buy. `interval` is null for the one-time payment. */
export type Offer = "plusMonthly" | "plusOnce" | "proMonthly";

export const OFFERS: Record<Offer, { product: "plus" | "pro"; recurring: boolean }> = {
  plusMonthly: { product: "plus", recurring: true },
  plusOnce: { product: "plus", recurring: false },
  proMonthly: { product: "pro", recurring: true },
};

/** Display prices (EUR). The real price is whatever the payment provider charges. */
export const PRICES: Record<Offer, number> = {
  plusMonthly: 9.99,
  plusOnce: 79,
  proMonthly: 49,
};

/**
 * How long a one-time Vow Plus lasts: until 90 days after the wedding, and at
 * least 12 months from the purchase (for couples with no date yet or a near date).
 */
export function oneTimeValidUntil(paidAt: Date, weddingDate: string | null): Date {
  const yearLater = new Date(paidAt);
  yearLater.setUTCFullYear(yearLater.getUTCFullYear() + 1);
  if (!weddingDate) return yearLater;
  const afterWedding = new Date(`${weddingDate}T00:00:00Z`);
  if (Number.isNaN(afterWedding.getTime())) return yearLater;
  afterWedding.setUTCDate(afterWedding.getUTCDate() + 90);
  return afterWedding > yearLater ? afterWedding : yearLater;
}
