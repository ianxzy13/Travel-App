"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { EASE, Reveal } from "@/components/motion/reveal";

const ROWS = [
  "tripPage",
  "entryChecklist",
  "roomsPerGuest",
  "paperwork",
  "guestLanguages",
  "dualBudget",
  "familyRoles",
] as const;

/** A tick that draws itself, like a pen stroke. */
function DrawnCheck({ label, delay }: { label: string; delay: number }) {
  return (
    <svg viewBox="0 0 24 24" className="text-success mx-auto size-6" role="img" aria-label={label}>
      <motion.path
        d="M5 12.5l4.5 4.5L19 7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: EASE, delay }}
      />
    </svg>
  );
}

/** Vow next to typical US wedding apps; rows slide in and Vow's ticks draw themselves. */
export function LandingCompare() {
  const t = useTranslations("landing");
  return (
    <section className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:py-28">
      <Reveal>
        <h2 className="text-center text-3xl font-light sm:text-4xl">{t("compareTitle")}</h2>
      </Reveal>
      <div className="mt-12 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b">
              <th scope="col" className="py-4 pe-4 text-start font-normal">
                <span className="sr-only">{t("compareTitle")}</span>
              </th>
              <th scope="col" className="caps text-primary-ink w-20 py-4 text-center sm:w-28">
                {t("compare.vow")}
              </th>
              <th scope="col" className="caps text-muted-foreground w-20 py-4 text-center sm:w-28">
                {t("compare.others")}
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((key, i) => (
              <motion.tr
                key={key}
                className="hover:bg-primary-soft/40 border-b transition-colors"
                initial={{ opacity: 0, x: -24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5, ease: EASE, delay: i * 0.06 }}
              >
                <th scope="row" className="py-4 pe-4 text-start text-base font-normal">
                  {t(`compare.${key}`)}
                </th>
                <td className="py-4">
                  <DrawnCheck label={t("compare.yes")} delay={0.25 + i * 0.06} />
                </td>
                <td className="text-muted-foreground py-4 text-center">
                  <span aria-label={t("compare.no")}>—</span>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
