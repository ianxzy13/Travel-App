"use server";

import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/action-result";
import { createPortalLink } from "@/lib/billing/paddle";
import { err } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/wedding";

/** Opens Paddle's page for changing the card, invoices and cancelling. */
export async function openBillingPortal(): Promise<ActionResult> {
  const user = await requireUser();
  const sb = await createClient();
  const { data } = await sb
    .from("subscriptions")
    .select("provider_id, provider_customer_id, kind, status")
    .eq("user_id", user.id)
    .eq("provider", "paddle")
    .order("created_at", { ascending: false });
  const customerId = data?.find((s) => s.provider_customer_id)?.provider_customer_id;
  if (!customerId) return await err("generic");
  const subscriptionIds = (data ?? [])
    .filter((s) => s.kind === "recurring" && s.status !== "canceled")
    .map((s) => s.provider_id);
  const url = await createPortalLink(customerId, subscriptionIds);
  if (!url) return await err("generic");
  redirect(url);
}
