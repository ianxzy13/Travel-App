// Paddle (payments). Paddle is the "merchant of record": it charges the card and
// handles VAT and sales tax for every country, then pays Vow out.
// Server only: uses the secret API key and webhook secret.
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { PADDLE_ENV, PRICE_IDS, offerForPriceId } from "./config";
import { OFFERS, type Offer } from "./plans";

export const PADDLE_API_KEY = process.env.PADDLE_API_KEY ?? "";
export const PADDLE_WEBHOOK_SECRET = process.env.PADDLE_WEBHOOK_SECRET ?? "";

const API_BASE =
  PADDLE_ENV === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";

/**
 * Checks the Paddle-Signature header ("ts=1700000000;h1=<hex>"): an HMAC-SHA256
 * of "<ts>:<raw body>" with the webhook secret. Rejects anything older than
 * `toleranceSec` so an old message can't be replayed.
 */
export function verifyPaddleSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  nowSec = Math.floor(Date.now() / 1000),
  toleranceSec = 300,
): boolean {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(
    header.split(";").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    }),
  );
  const ts = Number(parts.ts);
  const sent = parts.h1;
  if (!Number.isFinite(ts) || !sent || Math.abs(nowSec - ts) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(`${parts.ts}:${rawBody}`).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(sent, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});
const str = (v: unknown) => (typeof v === "string" && v ? v : null);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = (v: unknown) => {
  const s = str(v);
  return s && UUID.test(s) ? s : null;
};

export type SubscriptionUpsert = {
  user_id: string;
  wedding_id: string | null;
  product: "plus" | "pro";
  kind: "recurring" | "one_time";
  provider: "paddle";
  provider_id: string;
  provider_customer_id: string | null;
  status: string;
  valid_until: string | null;
  cancel_at: string | null;
};

export type WebhookAction =
  | { type: "upsert"; row: SubscriptionUpsert; paidAt: string | null }
  | { type: "refund"; providerId: string }
  | { type: "ignore"; reason: string };

/**
 * Turns one Paddle webhook event into what to save. Pure, so it is tested
 * without a database. `custom_data` is what the checkout sent (user_id and
 * wedding_id); the price id decides the product.
 */
export function mapPaddleEvent(
  event: { event_type?: unknown; data?: unknown },
  priceIds: Record<Offer, string> = PRICE_IDS,
): WebhookAction {
  const type = str(event.event_type) ?? "";
  const data = obj(event.data);
  const custom = obj(data.custom_data);
  const items = Array.isArray(data.items) ? data.items : [];
  const priceId = str(obj(obj(items[0]).price).id) ?? str(obj(items[0]).price_id);
  // Only the price decides what was bought: custom_data comes from the browser.
  const offer = offerForPriceId(priceId, priceIds);
  const userId = uuid(custom.user_id);

  if (type.startsWith("adjustment.")) {
    const txn = str(data.transaction_id);
    if (data.action === "refund" && data.status === "approved" && txn) {
      return { type: "refund", providerId: txn };
    }
    return { type: "ignore", reason: "adjustment not an approved refund" };
  }

  if (!offer) return { type: "ignore", reason: `unknown price ${priceId}` };
  if (!userId) return { type: "ignore", reason: "no user_id in custom_data" };
  const { product, recurring } = OFFERS[offer];
  const base = {
    user_id: userId,
    wedding_id: product === "plus" ? uuid(custom.wedding_id) : null,
    product,
    provider: "paddle" as const,
    provider_customer_id: str(data.customer_id),
  };

  if (type.startsWith("subscription.")) {
    const id = str(data.id);
    if (!id || !recurring) return { type: "ignore", reason: "not a subscription" };
    const period = obj(data.current_billing_period);
    const change = obj(data.scheduled_change);
    const status = str(data.status) ?? "active";
    return {
      type: "upsert",
      paidAt: null,
      row: {
        ...base,
        kind: "recurring",
        provider_id: id,
        status,
        valid_until:
          status === "canceled"
            ? (str(data.canceled_at) ?? new Date().toISOString())
            : str(period.ends_at),
        cancel_at: change.action === "cancel" ? str(change.effective_at) : null,
      },
    };
  }

  if (type === "transaction.completed" || type === "transaction.paid") {
    // Subscriptions are saved from their own subscription.* events.
    if (recurring || data.subscription_id) return { type: "ignore", reason: "recurring payment" };
    const id = str(data.id);
    if (!id) return { type: "ignore", reason: "no transaction id" };
    return {
      type: "upsert",
      paidAt: str(data.billed_at) ?? str(data.created_at),
      row: {
        ...base,
        kind: "one_time",
        provider_id: id,
        status: "paid",
        valid_until: null, // set by the webhook from the wedding date
        cancel_at: null,
      },
    };
  }

  return { type: "ignore", reason: `event ${type}` };
}

/** A one-time link to Paddle's page where people change card, see invoices or cancel. */
export async function createPortalLink(customerId: string, subscriptionIds: string[]) {
  if (!PADDLE_API_KEY) return null;
  const res = await fetch(
    `${API_BASE}/customers/${encodeURIComponent(customerId)}/portal-sessions`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${PADDLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ subscription_ids: subscriptionIds }),
      cache: "no-store",
    },
  );
  if (!res.ok) {
    console.error("[paddle portal]", res.status, await res.text().catch(() => ""));
    return null;
  }
  const json = obj(await res.json());
  return str(obj(obj(obj(json.data).urls).general).overview);
}
