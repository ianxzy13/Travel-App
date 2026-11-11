import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/app/page-header";
import { BillingPlans } from "@/components/billing/billing-plans";
import { ManageButton } from "@/components/billing/manage-button";
import { BILLING_ENABLED, isCheckoutConfigured } from "@/lib/billing/config";
import { FREE_LIMITS, type Feature } from "@/lib/billing/plans";
import { getWeddingPlan } from "@/lib/billing/server";
import { fmtDate } from "@/lib/i18n/format";
import { createClient } from "@/lib/supabase/server";
import { canManage, requireUser, requireWedding } from "@/lib/wedding";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("billing"))("title") };
}

const FEATURES: Feature[] = [
  "unlimitedGuests",
  "sms",
  "exports",
  "seatingScenarios",
  "shuttles",
  "noBranding",
  "manyWeddings",
];

/** /app/billing — the wedding's plan, the three plans, and managing what you pay for. */
export default async function Billing({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string; need?: string }>;
}) {
  const [{ wedding, role }, user, params, t, locale] = await Promise.all([
    requireWedding(),
    requireUser(),
    searchParams,
    getTranslations("billing"),
    getLocale(),
  ]);
  const plan = await getWeddingPlan(wedding.id);
  const { data: subs } = await (
    await createClient()
  )
    .from("subscriptions")
    .select("product, kind, status, valid_until, cancel_at, provider_customer_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  const active = (subs ?? []).filter(
    (s) =>
      ["active", "trialing", "past_due", "paid"].includes(s.status) &&
      (!s.valid_until || new Date(s.valid_until) > new Date()),
  );
  const hasCustomer = (subs ?? []).some((s) => s.provider_customer_id);
  const need = FEATURES.find((f) => f === params.need);
  const planName = { free: t("plans.free.name"), plus: "Vow Plus", pro: "Vow Pro" }[plan];

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description", { plan: planName })}
        actions={hasCustomer ? <ManageButton /> : undefined}
      />

      <div className="space-y-10">
        {!BILLING_ENABLED && <Notice>{t("notEnabled")}</Notice>}
        {BILLING_ENABLED && params.paid === "1" && <Notice>{t("thanks")}</Notice>}
        {BILLING_ENABLED && need && plan === "free" && (
          <Notice>
            {t(`locked.${need}`, {
              plan: need === "manyWeddings" ? "Vow Pro" : "Vow Plus",
              guests: FREE_LIMITS.guests,
            })}
          </Notice>
        )}

        {active.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-serif text-2xl">{t("yours")}</h2>
            <ul className="space-y-2 text-sm">
              {active.map((s, i) => (
                <li key={i} className="bg-card rounded-md border p-4">
                  <span className="font-medium">
                    {s.product === "pro" ? "Vow Pro" : "Vow Plus"}
                  </span>
                  <span className="text-muted-foreground">
                    {" · "}
                    {s.cancel_at
                      ? t("endsOn", { date: fmtDate(s.cancel_at.slice(0, 10), locale) })
                      : s.kind === "one_time"
                        ? t("validUntil", {
                            date: fmtDate(s.valid_until?.slice(0, 10) ?? null, locale),
                          })
                        : t("renewsOn", {
                            date: fmtDate(s.valid_until?.slice(0, 10) ?? null, locale),
                          })}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <BillingPlans
          plan={plan}
          canBuyPlus={canManage(role)}
          checkoutReady={BILLING_ENABLED && isCheckoutConfigured}
          userId={user.id}
          email={user.email ?? ""}
          weddingId={wedding.id}
        />

        <p className="text-muted-foreground max-w-2xl text-xs">{t("fineprint")}</p>
      </div>
    </>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="bg-primary-soft rounded-md px-4 py-3 text-sm">{children}</p>;
}
