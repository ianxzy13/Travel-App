import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/twilio/webhook
 * Twilio calls this for SMS delivery status and incoming messages (opt-out).
 * Configure in Twilio: Messaging > Phone Number > Webhook URL.
 */
export async function POST(request: Request) {
  const admin = createAdminClient();
  if (!admin) return new Response("Not configured", { status: 501 });

  const body = await request.text();
  const params = new URLSearchParams(body);

  const messageSid = params.get("MessageSid") ?? params.get("SmsSid");
  const messageStatus = params.get("MessageStatus");
  const incomingBody = params.get("Body")?.trim().toLowerCase();
  const from = params.get("From");

  // Incoming message — handle opt-out (STOP/UNSUBSCRIBE)
  if (incomingBody && from) {
    const optOutWords = ["stop", "unsubscribe", "cancel", "end", "quit"];
    if (optOutWords.includes(incomingBody)) {
      const { error } = await admin
        .from("save_the_date_sends")
        .update({ status: "opted_out", error: "opted_out" })
        .eq("to_address", from)
        .in("status", ["not_sent", "queued", "sent", "delivered"]);
      if (error) console.error("[twilio webhook] opt-out", error);
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { "Content-Type": "text/xml" } },
      );
    }
  }

  // Delivery status update
  if (messageSid && messageStatus) {
    const statusMap: Record<string, string> = {
      queued: "queued",
      sent: "sent",
      delivered: "delivered",
      read: "opened",
      failed: "failed",
      undelivered: "failed",
    };
    const mappedStatus = statusMap[messageStatus] as
      | "queued" | "sent" | "delivered" | "opened" | "failed"
      | undefined;
    if (mappedStatus) {
      const now = new Date().toISOString();
      const { error } = await admin
        .from("save_the_date_sends")
        .update({
          status: mappedStatus,
          delivered_at: mappedStatus === "delivered" ? now : undefined,
          opened_at: mappedStatus === "opened" ? now : undefined,
          error: mappedStatus === "failed"
            ? (params.get("ErrorMessage")?.slice(0, 500) ?? "delivery failed")
            : undefined,
        })
        .eq("resend_id", messageSid);
      if (error) console.error("[twilio webhook]", error);
    }
  }

  return new Response("OK");
}
