"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import { useTranslations } from "next-intl";
import { AppLanguagePicker } from "@/components/app-language-picker";
import { Logo } from "@/components/logo";
import { EASE, SPRING } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "#features", key: "features" },
  { href: "#pricing", key: "pricing" },
  { href: "#faq", key: "faq" },
] as const;

/**
 * Sticky top bar: see-through over the hero, then a soft card with a line
 * underneath once you scroll. On phones the links fold into a menu.
 */
export function LandingNavbar() {
  const t = useTranslations("landing");
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 12));

  // Close the phone menu with Escape, and don't let the page scroll behind it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  return (
    <motion.header
      className="sticky top-0 z-40"
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: EASE }}
    >
      <div
        className={cn(
          "transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300",
          open
            ? "bg-background border-b shadow-sm"
            : scrolled
              ? "bg-background/85 border-b shadow-sm backdrop-blur-md"
              : "border-b border-transparent bg-transparent",
        )}
      >
        <nav
          aria-label={t("nav.label")}
          className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6"
        >
          <Logo />

          {/* Section links (tablet and up), with a soft pill that follows the mouse */}
          <ul className="hidden items-center gap-1 md:flex" onMouseLeave={() => setHovered(null)}>
            {LINKS.map((l) => (
              <li key={l.key} className="relative">
                <a
                  href={l.href}
                  onMouseEnter={() => setHovered(l.key)}
                  onFocus={() => setHovered(l.key)}
                  className="text-muted-foreground hover:text-foreground relative z-10 block rounded-full px-4 py-2 text-sm transition-colors"
                >
                  {t(`nav.${l.key}`)}
                </a>
                {hovered === l.key && (
                  <motion.span
                    layoutId="nav-pill"
                    className="bg-primary-soft absolute inset-0 rounded-full"
                    transition={SPRING}
                  />
                )}
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2">
            <AppLanguagePicker className="hidden sm:flex" />
            <Button asChild variant="ghost" className="caps hidden sm:inline-flex">
              <Link href="/login">{t("signIn")}</Link>
            </Button>
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link href="/login">{t("getStarted")}</Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-expanded={open}
              aria-controls="landing-menu"
              aria-label={open ? t("nav.close") : t("nav.menu")}
              onClick={() => setOpen((o) => !o)}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={open ? "x" : "menu"}
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="inline-flex"
                >
                  {open ? <X aria-hidden /> : <Menu aria-hidden />}
                </motion.span>
              </AnimatePresence>
            </Button>
          </div>
        </nav>

        {/* Phone menu: slides down under the bar */}
        <AnimatePresence>
          {open && (
            <motion.div
              id="landing-menu"
              className="overflow-hidden md:hidden"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
            >
              <motion.ul
                className="flex flex-col gap-1 px-4 pt-2 pb-6"
                initial="hidden"
                animate="shown"
                variants={{ shown: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } } }}
              >
                {LINKS.map((l) => (
                  <motion.li
                    key={l.key}
                    variants={{ hidden: { opacity: 0, x: -12 }, shown: { opacity: 1, x: 0 } }}
                  >
                    <a
                      href={l.href}
                      onClick={() => setOpen(false)}
                      className="hover:bg-primary-soft block rounded-lg px-3 py-3 text-lg transition-colors"
                    >
                      {t(`nav.${l.key}`)}
                    </a>
                  </motion.li>
                ))}
                <motion.li
                  variants={{ hidden: { opacity: 0, x: -12 }, shown: { opacity: 1, x: 0 } }}
                  className="mt-3 flex flex-col gap-2 border-t pt-4"
                >
                  <AppLanguagePicker />
                  <Button asChild variant="outline" className="w-full">
                    <Link href="/login">{t("signIn")}</Link>
                  </Button>
                  <Button asChild className="w-full">
                    <Link href="/login">{t("getStarted")}</Link>
                  </Button>
                </motion.li>
              </motion.ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.header>
  );
}
