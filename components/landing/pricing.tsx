"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { EASE, Reveal, SPRING } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";

const INCLUDED = ["guests", "trip", "rooms", "paperwork", "languages", "family"] as const;

/** One plan: free. The card rises in and lifts on hover; its list ticks in. */
export function LandingPricing() {
  const t = useTranslations("landing.pricing");
  return (
    <section id="pricing" className="bg-blush/35 scroll-mt-20 border-y px-4 py-20 sm:px-6 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal className="text-center">
          <p className="eyebrow">{t("eyebrow")}</p>
          <h2 className="mt-2 text-4xl font-light sm:text-5xl">{t("title")}</h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-lg">{t("text")}</p>
        </Reveal>

        <motion.div
          className="bg-card mx-auto mt-12 max-w-md rounded-lg border p-8 shadow-sm"
          initial={{ opacity: 0, y: 48, scale: 0.96 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8, ease: EASE }}
          whileHover={{ y: -8 }}
        >
          <p className="caps text-primary-ink">{t("plan")}</p>
          <p className="mt-4 flex items-baseline gap-2">
            <span className="font-serif text-6xl font-light">{t("price")}</span>
            <span className="text-muted-foreground">{t("priceNote")}</span>
          </p>
          <motion.ul
            className="mt-8 space-y-3"
            initial="hidden"
            whileInView="shown"
            viewport={{ once: true, amount: 0.5 }}
            variants={{ shown: { transition: { staggerChildren: 0.08, delayChildren: 0.4 } } }}
          >
            {INCLUDED.map((key) => (
              <motion.li
                key={key}
                className="flex items-start gap-3"
                variants={{
                  hidden: { opacity: 0, x: -12 },
                  shown: { opacity: 1, x: 0, transition: { duration: 0.4, ease: EASE } },
                }}
              >
                <motion.span
                  className="bg-primary-soft text-primary-ink mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full"
                  variants={{ hidden: { scale: 0 }, shown: { scale: 1, transition: SPRING } }}
                >
                  <Check className="size-3" aria-hidden />
                </motion.span>
                {t(`includes.${key}`)}
              </motion.li>
            ))}
          </motion.ul>
          <Button asChild size="lg" className="mt-8 w-full">
            <Link href="/login">{t("cta")}</Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
