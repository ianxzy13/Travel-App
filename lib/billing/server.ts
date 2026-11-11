import "server-only";
import { cache } from "react";
import { getTranslations } from "next-intl/server";
import type { PlanName } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import { BILLING_ENABLED } from "./config";
import { effectivePlan, FREE_LIMITS, planAllows, planFor, type Feature } from "./plans";

/** The plan a wedding is on (everything is included while payments are off). */
export const getWeddingPlan = cache(async (weddingId: string): Promise<PlanName> => {
  if (!BILLING_ENABLED) return effectivePlan(false, null);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("wedding_plan", { wid: weddingId });
  if (error) console.error("[wedding_plan]", error);
  return effectivePlan(true, data ?? null);
});

/** Does the wedding's plan include this feature? */
export async function hasFeature(weddingId: string, feature: Feature) {
  return planAllows(await getWeddingPlan(weddingId), feature);
}

/** A failed ActionResult explaining which plan includes the feature. */
export async function planLimit(feature: Feature) {
  const t = await getTranslations("billing.locked");
  const plan = planFor(feature) === "plus" ? "Vow Plus" : "Vow Pro";
  return {
    ok: false as const,
    error: t(feature, { plan, guests: FREE_LIMITS.guests }),
  };
}

/** null when allowed, otherwise the failed ActionResult to return from an action. */
export async function requireFeature(weddingId: string, feature: Feature) {
  return (await hasFeature(weddingId, feature)) ? null : await planLimit(feature);
}

/** Would adding `adding` guests go over the free plan's guest limit? */
export async function guestLimitError(weddingId: string, adding: number) {
  if (adding <= 0 || (await hasFeature(weddingId, "unlimitedGuests"))) return null;
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("guests")
    .select("id", { count: "exact", head: true })
    .eq("wedding_id", weddingId);
  if (error) {
    console.error("[guestLimit]", error);
    return null;
  }
  return (count ?? 0) + adding > FREE_LIMITS.guests ? await planLimit("unlimitedGuests") : null;
}

/** May the signed-in person create another wedding? (Free: one wedding they own.) */
export async function canCreateAnotherWedding(userId: string) {
  if (!BILLING_ENABLED) return true;
  const supabase = await createClient();
  const [{ count }, { data: pro }] = await Promise.all([
    supabase
      .from("wedding_members")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("role", "owner"),
    supabase.rpc("user_has_pro"),
  ]);
  return Boolean(pro) || (count ?? 0) < FREE_LIMITS.weddings;
}
