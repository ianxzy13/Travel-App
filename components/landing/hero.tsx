"use client";

import { useRef } from "react";
import Link from "next/link";
import { BedDouble, Bus, Check, Plane, Stamp, Users } from "lucide-react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import { useTranslations } from "next-intl";
import { EASE, SPRING } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { InsideDialog } from "./inside-dialog";

const TRIP_ROWS = [
  { key: "flight", icon: Plane, detail: "flightDetail" },
  { key: "hotel", icon: BedDouble },
  { key: "shuttle", icon: Bus },
  { key: "table", icon: Users },
  { key: "passport", icon: Stamp },
] as const;

/** Headline, intro and buttons on the left; a guest's trip page coming to life on the right. */
export function LandingHero() {
  const t = useTranslations("landing");
  const words = t("title").split(" ");
  const section = useRef<HTMLElement>(null);
  // The trip card drifts up a little slower than the page as you scroll away.
  const { scrollYProgress } = useScroll({ target: section, offset: ["start start", "end start"] });
  const drift = useTransform(scrollYProgress, [0, 1], [0, -80]);

  return (
    <section
      ref={section}
      className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-8 pb-20 sm:px-6 md:pt-16 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:pb-28"
    >
      <div>
        <motion.p
          className="eyebrow"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          {t("eyebrow")}
        </motion.p>
        {/* each word slides up out of its own line */}
        <h1 className="mt-4 text-4xl leading-tight font-light sm:text-5xl lg:text-6xl">
          {words.map((w, i) => (
            <span key={i}>
              <span className="inline-block overflow-hidden pb-1 align-bottom">
                <motion.span
                  className="inline-block"
                  initial={{ y: "110%" }}
                  animate={{ y: 0 }}
                  transition={{ duration: 0.7, ease: EASE, delay: 0.1 + i * 0.06 }}
                >
                  {w}
                </motion.span>
              </span>
              {/* the space sits outside the box so it isn't swallowed */}
              {i < words.length - 1 && " "}
            </span>
          ))}
        </h1>
        <motion.p
          className="text-muted-foreground mt-6 max-w-xl text-lg leading-relaxed"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.2 + words.length * 0.06 }}
        >
          {t("intro")}
        </motion.p>
        <motion.div
          className="mt-8 flex flex-wrap gap-4"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.35 + words.length * 0.06 }}
        >
          <Button asChild size="lg">
            <Link href="/login">{t("start")}</Link>
          </Button>
          <InsideDialog />
        </motion.div>
      </div>

      <motion.div style={{ y: drift }}>
        <TripCard />
      </motion.div>
    </section>
  );
}

/** A sample guest's trip page: lines tick in one by one; the card floats and leans toward the mouse. */
function TripCard() {
  const t = useTranslations("landing.mock");
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [8, -8]), SPRING);
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-10, 10]), SPRING);

  return (
    <div
      className="mx-auto w-full max-w-sm [perspective:1000px]"
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        const r = e.currentTarget.getBoundingClientRect();
        x.set((e.clientX - r.left) / r.width - 0.5);
        y.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 40, rotate: -2 }}
        animate={
          reduce ? { opacity: 1, y: 0, rotate: 0 } : { opacity: 1, y: [0, -10, 0], rotate: 0 }
        }
        transition={{
          opacity: { duration: 0.8, ease: EASE, delay: 0.3 },
          rotate: { duration: 0.8, ease: EASE, delay: 0.3 },
          y: { duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1.1 },
        }}
        style={{ rotateX, rotateY }}
        className="bg-card rounded-lg border p-6 shadow-lg"
      >
        <div className="flex items-center justify-between gap-4 border-b pb-4">
          <div>
            <p className="eyebrow">{t("yourTrip")}</p>
            <p className="mt-1 font-serif text-2xl">{t("guestName")}</p>
          </div>
          <span className="bg-primary-soft text-primary-ink rounded-full px-3 py-1 text-xs">
            {t("langLabel")}
          </span>
        </div>
        <motion.ul
          className="mt-4 space-y-3"
          initial="hidden"
          animate="shown"
          variants={{ shown: { transition: { staggerChildren: 0.18, delayChildren: 0.9 } } }}
        >
          {TRIP_ROWS.map((row) => {
            const Icon = row.icon;
            return (
              <motion.li
                key={row.key}
                className="flex items-start gap-3"
                variants={{
                  hidden: { opacity: 0, x: 24 },
                  shown: { opacity: 1, x: 0, transition: { duration: 0.5, ease: EASE } },
                }}
              >
                <span className="bg-muted text-primary-ink inline-flex size-8 shrink-0 items-center justify-center rounded-full">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1 text-sm">
                  <span className="block">{t(row.key)}</span>
                  {"detail" in row && (
                    <span className="text-muted-foreground block text-xs">{t(row.detail)}</span>
                  )}
                </span>
                {/* the tick pops in just after its line */}
                <motion.span
                  className="text-success mt-1 inline-flex"
                  variants={{
                    hidden: { scale: 0, rotate: -45 },
                    shown: { scale: 1, rotate: 0, transition: { ...SPRING, delay: 0.25 } },
                  }}
                >
                  <Check className="size-4" aria-hidden />
                </motion.span>
              </motion.li>
            );
          })}
        </motion.ul>
      </motion.div>
    </div>
  );
}
