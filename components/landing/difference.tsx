"use client";

import { useRef } from "react";
import { BedDouble, Bus, FileCheck2, Languages, Plane, Stamp } from "lucide-react";
import { motion, useScroll, useSpring } from "framer-motion";
import { useTranslations } from "next-intl";
import { EASE, Reveal } from "@/components/motion/reveal";

const ITEMS = [
  { key: "trip", icon: Plane },
  { key: "entry", icon: Stamp },
  { key: "rooms", icon: BedDouble },
  { key: "shuttle", icon: Bus },
  { key: "paperwork", icon: FileCheck2 },
  { key: "languages", icon: Languages },
] as const;

/**
 * What other wedding apps don't do. The title stays put on wide screens while
 * a thin line draws down beside the six points as you scroll through them.
 */
export function LandingDifference() {
  const t = useTranslations("landing");
  const list = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({ target: list, offset: ["start 80%", "end 60%"] });
  const line = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });

  return (
    <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6 lg:py-28">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
        <Reveal className="lg:sticky lg:top-28 lg:self-start">
          <h2 className="text-4xl font-light sm:text-5xl">{t("differenceTitle")}</h2>
          <p className="text-muted-foreground mt-4 text-lg leading-relaxed">
            {t("differenceText")}
          </p>
        </Reveal>

        <ol ref={list} className="relative space-y-10 ps-12">
          {/* the track and the line that fills it */}
          <span className="bg-border absolute inset-y-0 start-4 w-px" aria-hidden />
          <motion.span
            className="bg-primary absolute inset-y-0 start-4 w-px origin-top"
            style={{ scaleY: line }}
            aria-hidden
          />
          {ITEMS.map(({ key, icon: Icon }, i) => (
            <motion.li
              key={key}
              className="relative"
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 0.7, ease: EASE }}
            >
              <motion.span
                className="bg-card text-primary-ink absolute -start-12 top-0 inline-flex size-8 items-center justify-center rounded-full border"
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true, amount: 0.6 }}
                transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.15 }}
              >
                <Icon className="size-4" aria-hidden />
              </motion.span>
              <p className="eyebrow">{String(i + 1).padStart(2, "0")}</p>
              <h3 className="mt-1 text-2xl">{t(`difference.${key}.title`)}</h3>
              <p className="text-muted-foreground mt-2 max-w-lg leading-relaxed">
                {t(`difference.${key}.text`)}
              </p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
