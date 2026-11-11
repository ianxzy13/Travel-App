import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { offerForPriceId } from "../config";
import { mapPaddleEvent, verifyPaddleSignature } from "../paddle";
import { effectivePlan, oneTimeValidUntil, planAllows, planFor } from "../plans";

const IDS = { plusMonthly: "pri_plus_m", plusOnce: "pri_plus_1", proMonthly: "pri_pro_m" };
const USER = "11111111-1111-4111-8111-111111111111";
const WEDDING = "22222222-2222-4222-8222-222222222222";

describe("plans", () => {
  it("free has none of the paid features, plus has them, pro adds many weddings", () => {
    expect(planAllows("free", "sms")).toBe(false);
    expect(planAllows("plus", "sms")).toBe(true);
    expect(planAllows("plus", "manyWeddings")).toBe(false);
    expect(planAllows("pro", "manyWeddings")).toBe(true);
    expect(planFor("exports")).toBe("plus");
    expect(planFor("manyWeddings")).toBe("pro");
  });

  it("keeps everything while payments are off", () => {
    expect(effectivePlan(false, "free")).toBe("pro");
    expect(effectivePlan(true, null)).toBe("free");
    expect(effectivePlan(true, "plus")).toBe("plus");
  });

  it("one-time Plus lasts 90 days after the wedding, at least a year", () => {
    const paid = new Date("2026-11-11T10:00:00Z");
    expect(oneTimeValidUntil(paid, "2027-09-04").toISOString()).toBe("2027-12-03T00:00:00.000Z");
    expect(oneTimeValidUntil(paid, "2027-01-10").toISOString()).toBe("2027-11-11T10:00:00.000Z");
    expect(oneTimeValidUntil(paid, null).toISOString()).toBe("2027-11-11T10:00:00.000Z");
  });

  it("finds the offer of a price id", () => {
    expect(offerForPriceId("pri_pro_m", IDS)).toBe("proMonthly");
    expect(offerForPriceId("pri_other", IDS)).toBeNull();
    expect(offerForPriceId(null, IDS)).toBeNull();
  });
});

describe("Paddle signature", () => {
  const secret = "pdl_ntfset_test";
  const body = '{"event_type":"subscription.created"}';
  const sign = (ts: number, b = body) =>
    `ts=${ts};h1=${createHmac("sha256", secret).update(`${ts}:${b}`).digest("hex")}`;

  it("accepts a fresh, correct signature", () => {
    expect(verifyPaddleSignature(body, sign(1000), secret, 1010)).toBe(true);
  });
  it("rejects a changed body, wrong secret, old message or missing header", () => {
    expect(verifyPaddleSignature(body + " ", sign(1000), secret, 1010)).toBe(false);
    expect(verifyPaddleSignature(body, sign(1000), "other", 1010)).toBe(false);
    expect(verifyPaddleSignature(body, sign(1000), secret, 2000)).toBe(false);
    expect(verifyPaddleSignature(body, null, secret, 1010)).toBe(false);
    expect(verifyPaddleSignature(body, "ts=1000;h1=zz", secret, 1010)).toBe(false);
  });
});

describe("mapPaddleEvent", () => {
  const sub = (over: Record<string, unknown> = {}) => ({
    event_type: "subscription.updated",
    data: {
      id: "sub_1",
      status: "active",
      customer_id: "ctm_1",
      items: [{ price: { id: "pri_plus_m" } }],
      custom_data: { user_id: USER, wedding_id: WEDDING, offer: "plusMonthly" },
      current_billing_period: {
        starts_at: "2026-11-11T00:00:00Z",
        ends_at: "2026-12-11T00:00:00Z",
      },
      scheduled_change: null,
      ...over,
    },
  });

  it("saves a monthly Plus subscription for the wedding", () => {
    const a = mapPaddleEvent(sub(), IDS);
    expect(a).toMatchObject({
      type: "upsert",
      row: {
        user_id: USER,
        wedding_id: WEDDING,
        product: "plus",
        kind: "recurring",
        provider_id: "sub_1",
        provider_customer_id: "ctm_1",
        status: "active",
        valid_until: "2026-12-11T00:00:00Z",
        cancel_at: null,
      },
    });
  });

  it("notes when a cancelled subscription stops", () => {
    const a = mapPaddleEvent(
      sub({ scheduled_change: { action: "cancel", effective_at: "2026-12-11T00:00:00Z" } }),
      IDS,
    );
    expect(a.type === "upsert" && a.row.cancel_at).toBe("2026-12-11T00:00:00Z");
  });

  it("Pro is not tied to one wedding", () => {
    const a = mapPaddleEvent(sub({ items: [{ price: { id: "pri_pro_m" } }] }), IDS);
    expect(a.type === "upsert" && a.row.product).toBe("pro");
    expect(a.type === "upsert" && a.row.wedding_id).toBeNull();
  });

  it("saves a one-time Plus from its transaction, skips subscription payments", () => {
    const once = mapPaddleEvent(
      {
        event_type: "transaction.completed",
        data: {
          id: "txn_1",
          subscription_id: null,
          billed_at: "2026-11-11T10:00:00Z",
          items: [{ price: { id: "pri_plus_1" } }],
          custom_data: { user_id: USER, wedding_id: WEDDING },
        },
      },
      IDS,
    );
    expect(once).toMatchObject({
      type: "upsert",
      paidAt: "2026-11-11T10:00:00Z",
      row: { kind: "one_time", provider_id: "txn_1", status: "paid", wedding_id: WEDDING },
    });
    const renewal = mapPaddleEvent(
      {
        event_type: "transaction.completed",
        data: { id: "txn_2", subscription_id: "sub_1", items: [{ price: { id: "pri_plus_m" } }] },
      },
      IDS,
    );
    expect(renewal.type).toBe("ignore");
  });

  it("marks approved refunds, ignores the rest", () => {
    expect(
      mapPaddleEvent(
        {
          event_type: "adjustment.updated",
          data: { action: "refund", status: "approved", transaction_id: "txn_1" },
        },
        IDS,
      ),
    ).toEqual({ type: "refund", providerId: "txn_1" });
    expect(
      mapPaddleEvent(
        {
          event_type: "adjustment.created",
          data: { action: "refund", status: "pending_approval", transaction_id: "txn_1" },
        },
        IDS,
      ).type,
    ).toBe("ignore");
  });

  it("ignores events without a valid user or with an unknown price", () => {
    expect(mapPaddleEvent(sub({ custom_data: { user_id: "not-a-uuid" } }), IDS).type).toBe(
      "ignore",
    );
    expect(
      mapPaddleEvent(
        sub({ items: [{ price: { id: "pri_x" } }], custom_data: { user_id: USER } }),
        IDS,
      ).type,
    ).toBe("ignore");
  });
});
