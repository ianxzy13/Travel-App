"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { BILLING_ENABLED } from "@/lib/billing/config";
import { FREE_LIMITS, PRICES } from "@/lib/billing/plans";
import { fmtMoney } from "@/lib/i18n/format";
import { EASE, Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";

/** Free, Vow Plus and Vow Pro. Plus and Pro say "soon" until payments are on. */
export function LandingPricing() {
  return <PaidPricing />;
}

/** Free, Vow Plus and Vow Pro side by side. */
function PaidPricing() {
  const t = useTranslations("billing");
  const p = useTranslations("landing.pricing");
  const locale = useLocale();
  const money = (n: number) => fmtMoney(n, "EUR", locale, !Number.isInteger(n));
  const plans = [
    {
      name: t("plans.free.name"),
      price: money(0),
      note: t("plans.free.note"),
      features: (["guests", "languages", "everything"] as const).map((k) =>
        t(`plans.free.features.${k}`, { guests: FREE_LIMITS.guests }),
      ),
      main: true,
    },
    {
      name: "Vow Plus",
      price: money(PRICES.plusMonthly),
      per: t("perMonth"),
      note: t("plans.plus.note", { once: money(PRICES.plusOnce) }),
      features: (
        ["unlimitedGuests", "sms", "exports", "shuttles", "seatingScenarios", "noBranding"] as const
      ).map((k) => t(`plans.plus.features.${k}`)),
    },
    {
      name: "Vow Pro",
      price: money(PRICES.proMonthly),
      per: t("perMonth"),
      note: t("plans.pro.note"),
      features: (["allWeddings", "manyWeddings", "couplesFree"] as const).map((k) =>
        t(`plans.pro.features.${k}`),
      ),
    },
  ];
  return (
    <section id="pricing" className="bg-blush/35 scroll-mt-20 border-y px-4 py-20 sm:px-6 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal className="text-center">
          <p className="eyebrow">{p("eyebrow")}</p>
          <h2 className="mt-2 text-4xl font-light sm:text-5xl">{t("landingTitle")}</h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-lg">{t("landingText")}</p>
          {!BILLING_ENABLED && (
            <p className="text-primary-ink mx-auto mt-4 max-w-xl text-sm">{t("soonNote")}</p>
          )}
        </Reveal>
        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              className="bg-card flex flex-col rounded-lg border p-8 shadow-sm"
              initial={{ opacity: 0, y: 48 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.8, ease: EASE, delay: i * 0.1 }}
              whileHover={{ y: -8 }}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="caps text-primary-ink">{plan.name}</p>
                {!plan.main && !BILLING_ENABLED && (
                  <span className="bg-tint-sand text-tint-sand-fg rounded-full px-3 py-1 text-xs">
                    {t("soon")}
                  </span>
                )}
              </div>
              <p className="mt-4 flex items-baseline gap-2">
                <span className="font-serif text-5xl font-light">{plan.price}</span>
                {plan.per && <span className="text-muted-foreground">{plan.per}</span>}
              </p>
              <p className="text-muted-foreground mt-2 text-sm">{plan.note}</p>
              <ul className="mt-8 flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <span className="bg-primary-soft text-primary-ink mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full">
                      <Check className="size-3" aria-hidden />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              {plan.main && (
                <Button asChild size="lg" className="mt-8 w-full">
                  <Link href="/login">{t("landingCta")}</Link>
                </Button>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
