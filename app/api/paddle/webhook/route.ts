import { mapPaddleEvent, PADDLE_WEBHOOK_SECRET, verifyPaddleSignature } from "@/lib/billing/paddle";
import { oneTimeValidUntil } from "@/lib/billing/plans";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/paddle/webhook
 * Paddle calls this when someone pays, renews, cancels or gets a refund, and
 * we save it in `subscriptions`. Needs PADDLE_WEBHOOK_SECRET and
 * SUPABASE_SECRET_KEY (see README "Set up payments"). The signature check makes
 * sure the request really comes from Paddle.
 */
export async function POST(request: Request) {
  const admin = createAdminClient();
  if (!PADDLE_WEBHOOK_SECRET || !admin)
    return new Response("Webhook not configured", { status: 501 });

  const payload = await request.text();
  if (
    !verifyPaddleSignature(payload, request.headers.get("paddle-signature"), PADDLE_WEBHOOK_SECRET)
  ) {
    return new Response("Invalid signature", { status: 401 });
  }

  let event: { event_type?: unknown; data?: unknown };
  try {
    event = JSON.parse(payload);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const action = mapPaddleEvent(event);

  if (action.type === "refund") {
    const { error } = await admin
      .from("subscriptions")
      .update({ status: "refunded" })
      .eq("provider", "paddle")
      .eq("provider_id", action.providerId);
    if (error) {
      console.error("[paddle webhook refund]", error);
      return new Response("Error", { status: 500 }); // Paddle will retry
    }
    return new Response("OK");
  }

  if (action.type === "ignore") return new Response("OK");

  const row = { ...action.row };
  if (row.kind === "one_time") {
    let weddingDate: string | null = null;
    if (row.wedding_id) {
      const { data } = await admin
        .from("weddings")
        .select("wedding_date")
        .eq("id", row.wedding_id)
        .maybeSingle();
      weddingDate = data?.wedding_date ?? null;
    }
    const paidAt = action.paidAt ? new Date(action.paidAt) : new Date();
    row.valid_until = oneTimeValidUntil(paidAt, weddingDate).toISOString();
  }

  const { error } = await admin
    .from("subscriptions")
    .upsert(row, { onConflict: "provider,provider_id" });
  if (error) {
    console.error("[paddle webhook]", error);
    return new Response("Error", { status: 500 }); // Paddle will retry
  }
  return new Response("OK");
}
