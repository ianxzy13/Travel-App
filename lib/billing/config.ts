// Payment settings from environment variables. Safe in the browser:
// only NEXT_PUBLIC_ values are read here (the secret ones are in ./paddle.ts).
import type { Offer } from "./plans";

/** Off until you set NEXT_PUBLIC_BILLING_ENABLED=true; until then everything stays free. */
export const BILLING_ENABLED = process.env.NEXT_PUBLIC_BILLING_ENABLED === "true";

/** "sandbox" (test cards, no real money) or "production". */
export const PADDLE_ENV: "sandbox" | "production" =
  process.env.NEXT_PUBLIC_PADDLE_ENV === "production" ? "production" : "sandbox";

export const PADDLE_CLIENT_TOKEN = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? "";

// Written out one by one: Next.js only fills in NEXT_PUBLIC_ values it can see literally.
export const PRICE_IDS: Record<Offer, string> = {
  plusMonthly: process.env.NEXT_PUBLIC_PADDLE_PRICE_PLUS_MONTHLY ?? "",
  plusOnce: process.env.NEXT_PUBLIC_PADDLE_PRICE_PLUS_ONCE ?? "",
  proMonthly: process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO_MONTHLY ?? "",
};

/** True when the buy buttons can open a checkout. */
export const isCheckoutConfigured = Boolean(
  PADDLE_CLIENT_TOKEN && PRICE_IDS.plusMonthly && PRICE_IDS.plusOnce && PRICE_IDS.proMonthly,
);

/** Which offer a Paddle price id belongs to (null for an unknown price). */
export function offerForPriceId(
  priceId: string | null | undefined,
  ids: Record<Offer, string> = PRICE_IDS,
): Offer | null {
  if (!priceId) return null;
  const hit = (Object.keys(ids) as Offer[]).find((o) => ids[o] === priceId);
  return hit ?? null;
}
