"use client";

import { useId, useState } from "react";
import { Plus } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { EASE, Reveal, SPRING, Stagger, StaggerItem } from "@/components/motion/reveal";

const QUESTIONS = ["free", "guests", "languages", "family", "phone", "privacy"] as const;

/** Questions that open smoothly; the + turns into a × while open. */
export function LandingFaq() {
  const t = useTranslations("landing.faq");
  const [open, setOpen] = useState<string | null>(QUESTIONS[0]);
  const base = useId();

  return (
    <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-20 sm:px-6 lg:py-28">
      <Reveal className="text-center">
        <h2 className="text-4xl font-light sm:text-5xl">{t("title")}</h2>
      </Reveal>
      <Stagger as="ul" className="mt-12 divide-y border-y">
        {QUESTIONS.map((q) => {
          const isOpen = open === q;
          const panel = `${base}-${q}`;
          return (
            <StaggerItem as="li" key={q}>
              <h3>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panel}
                  onClick={() => setOpen(isOpen ? null : q)}
                  className="hover:text-primary-ink focus-visible:ring-ring flex w-full items-center justify-between gap-4 py-6 text-start font-serif text-xl transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  {t(`${q}.q`)}
                  <motion.span
                    className="text-primary-ink inline-flex shrink-0"
                    animate={{ rotate: isOpen ? 45 : 0 }}
                    transition={SPRING}
                  >
                    <Plus className="size-5" aria-hidden />
                  </motion.span>
                </button>
              </h3>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    id={panel}
                    role="region"
                    className="overflow-hidden"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.35, ease: EASE }}
                  >
                    <p className="text-muted-foreground pe-10 pb-6 leading-relaxed">
                      {t(`${q}.a`)}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </StaggerItem>
          );
        })}
      </Stagger>
    </section>
  );
}
