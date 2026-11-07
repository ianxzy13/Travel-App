"use client";

import Link from "next/link";
import { BedDouble, Bus, FileCheck2, Languages, Plane, Stamp, type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { EASE } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import {
  WarpDialog,
  WarpDialogClose,
  WarpDialogContent,
  WarpDialogTitle,
  WarpDialogTrigger,
} from "@/components/ui/warp-dialog";

const DIFFERENCES: {
  key: "trip" | "entry" | "rooms" | "shuttle" | "paperwork" | "languages";
  icon: LucideIcon;
}[] = [
  { key: "trip", icon: Plane },
  { key: "entry", icon: Stamp },
  { key: "rooms", icon: BedDouble },
  { key: "shuttle", icon: Bus },
  { key: "paperwork", icon: FileCheck2 },
  { key: "languages", icon: Languages },
];

/** "See what's inside": what Vow does that other wedding apps don't, in the warp dialog. */
export function InsideDialog({ triggerClassName }: { triggerClassName?: string }) {
  const t = useTranslations("landing");
  return (
    <WarpDialog>
      <WarpDialogTrigger asChild>
        <Button size="lg" variant="outline" className={triggerClassName}>
          {t("seeInside")}
        </Button>
      </WarpDialogTrigger>
      <WarpDialogContent className="max-w-2xl">
        <p className="font-script text-primary-ink text-4xl" aria-hidden>
          Vow
        </p>
        <WarpDialogTitle className="sm:text-4xl">{t("differenceTitle")}</WarpDialogTitle>
        <p className="text-muted-foreground">{t("differenceText")}</p>
        {/* the six points arrive one after another once the dialog has opened */}
        <motion.ul
          className="mt-2 grid gap-4 sm:grid-cols-2"
          initial="hidden"
          animate="shown"
          variants={{ shown: { transition: { staggerChildren: 0.06, delayChildren: 0.3 } } }}
        >
          {DIFFERENCES.map(({ key, icon: Icon }) => (
            <motion.li
              key={key}
              className="flex gap-3"
              variants={{
                hidden: { opacity: 0, y: 12 },
                shown: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
              }}
            >
              <span className="bg-primary-soft text-primary-ink inline-flex size-9 shrink-0 items-center justify-center rounded-full">
                <Icon className="size-4" aria-hidden />
              </span>
              <span>
                <span className="block font-medium">{t(`difference.${key}.title`)}</span>
                <span className="text-muted-foreground block text-sm leading-relaxed">
                  {t(`difference.${key}.text`)}
                </span>
              </span>
            </motion.li>
          ))}
        </motion.ul>
        <div className="mt-2 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/login">{t("start")}</Link>
          </Button>
          <WarpDialogClose asChild>
            <Button asChild variant="ghost">
              <a href="#all-features">{t("featuresTitle")}</a>
            </Button>
          </WarpDialogClose>
        </div>
      </WarpDialogContent>
    </WarpDialog>
  );
}
