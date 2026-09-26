import { Webhook } from "svix";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/resend/webhook
 * Resend calls this when an email is delivered, opened or bounces, so the
 * RSVP page can show "opened". Optional: needs RESEND_WEBHOOK_SECRET and
 * SUPABASE_SECRET_KEY (see README). The signature check makes sure the
 * request really comes from Resend.
 */
export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const admin = createAdminClient();
  if (!secret || !admin) return new Response("Webhook not configured", { status: 501 });

  const payload = await request.text();
  try {
    // Throws if the signature is wrong or the request is too old (svix 2 returns nothing).
    new Webhook(secret).verify(payload, {
      "svix-id": request.headers.get("svix-id") ?? "",
      "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
      "svix-signature": request.headers.get("svix-signature") ?? "",
    });
  } catch {
    return new Response("Invalid signature", { status: 401 });
  }
  const event = JSON.parse(payload) as {
    type: string;
    created_at?: string;
    data?: { email_id?: string };
  };

  const tracked = ["email.delivered", "email.opened", "email.bounced", "email.complained"];
  const emailId = event.data?.email_id;
  if (tracked.includes(event.type) && emailId) {
    const { error } = await admin.rpc("record_email_event", {
      p_resend_id: emailId,
      p_event: event.type,
      p_at: event.created_at ?? new Date().toISOString(),
    });
    if (error) {
      console.error("[resend webhook]", error);
      return new Response("Error", { status: 500 }); // Resend will retry
    }
  }
  return new Response("OK");
}
