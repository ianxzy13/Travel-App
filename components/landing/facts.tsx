"use client";

import { useEffect, useRef } from "react";
import { animate, motion, useInView, useReducedMotion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { Stagger, StaggerItem } from "@/components/motion/reveal";

// Real numbers from the app: languages, countries with paperwork guides,
// currencies in the budget, and planner roles (owner, editor, parent, helper).
const FACTS = [
  { key: "languages", value: 25 },
  { key: "countries", value: 64 },
  { key: "currencies", value: 2 },
  { key: "roles", value: 4 },
] as const;

/** Counts from 0 up to `to` the first time it scrolls into view. */
function CountUp({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });
  const reduce = useReducedMotion();
  const locale = useLocale();
  useEffect(() => {
    const el = ref.current;
    if (!el || !inView) return;
    const fmt = new Intl.NumberFormat(locale);
    if (reduce) {
      el.textContent = fmt.format(to);
      return;
    }
    const controls = animate(0, to, {
      duration: 1.6,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => (el.textContent = fmt.format(Math.round(v))),
    });
    return () => controls.stop();
  }, [inView, to, reduce, locale]);
  // The real number is there from the start for screen readers and search engines.
  return (
    <span ref={ref} className="tabular-nums">
      {to}
    </span>
  );
}

/** Facts instead of testimonials: what Vow actually covers. */
export function LandingFacts() {
  const t = useTranslations("landing.facts");
  return (
    <section className="bg-sand/50 border-y px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <motion.h2
          className="text-center text-3xl font-light sm:text-4xl"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          {t("title")}
        </motion.h2>
        <Stagger
          as="ul"
          stagger={0.12}
          className="mt-12 grid gap-8 text-center sm:grid-cols-2 lg:grid-cols-4"
        >
          {FACTS.map((f) => (
            <StaggerItem as="li" key={f.key}>
              <p className="text-primary-ink font-serif text-6xl font-light sm:text-7xl">
                <CountUp to={f.value} />
              </p>
              <p className="text-muted-foreground mx-auto mt-2 max-w-48 leading-relaxed">
                {t(f.key)}
              </p>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
