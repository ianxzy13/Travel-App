import type { Metadata } from "next";
import Link from "next/link";
import {
  Armchair,
  CalendarHeart,
  Globe,
  Images,
  Landmark,
  Languages,
  MailCheck,
  Plane,
  Users,
  Wallet,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { AppLanguagePicker } from "@/components/app-language-picker";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { fmtMoney } from "@/lib/i18n/format";

const FEATURES = [
  { icon: Users, key: "guests" },
  { icon: MailCheck, key: "rsvp" },
  { icon: Armchair, key: "seating" },
  { icon: Wallet, key: "budget" },
  { icon: Landmark, key: "venues" },
  { icon: Plane, key: "travel" },
  { icon: Images, key: "inspiration" },
  { icon: Globe, key: "website" },
  { icon: CalendarHeart, key: "timeline" },
  { icon: Languages, key: "languages" },
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing");
  return { title: { absolute: t("metaTitle") }, description: t("metaDescription") };
}

export default async function LandingPage() {
  const t = await getTranslations("landing");
  return (
    <div className="min-h-dvh overflow-x-clip">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 sm:px-6">
        <Logo />
        <nav className="flex flex-wrap items-center gap-2">
          <AppLanguagePicker />
          <Button asChild variant="ghost">
            <Link href="/login">{t("signIn")}</Link>
          </Button>
          <Button asChild>
            <Link href="/login">{t("getStarted")}</Link>
          </Button>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-10 pb-20 sm:px-6 lg:grid-cols-2 lg:pt-20">
          <div>
            <p className="text-primary mb-4 text-sm font-medium tracking-wide uppercase">
              {t("eyebrow")}
            </p>
            <h1 className="text-5xl leading-[1.05] text-balance sm:text-6xl">{t("title")}</h1>
            <p className="text-muted-foreground mt-6 max-w-lg text-lg">{t("intro")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/login">{t("start")}</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#features">{t("seeInside")}</a>
              </Button>
            </div>
          </div>

          <HeroPreview />
        </section>

        {/* Features */}
        <section id="features" className="bg-card/60 border-t py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-4xl">{t("featuresTitle")}</h2>
            <p className="text-muted-foreground mx-auto mt-3 max-w-xl text-center">
              {t("featuresText")}
            </p>
            <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, key }) => (
                <li key={key} className="bg-background rounded-xl border p-6">
                  <span className="bg-primary-soft text-primary mb-4 inline-flex size-10 items-center justify-center rounded-full">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="text-2xl">{t(`features.${key}.title`)}</h3>
                  <p className="text-muted-foreground mt-1">{t(`features.${key}.text`)}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Closing call to action */}
        <section className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
          <h2 className="text-4xl sm:text-5xl">{t("closingTitle")}</h2>
          <p className="text-muted-foreground mt-4">{t("closingText")}</p>
          <Button asChild size="lg" className="mt-8">
            <Link href="/login">{t("create")}</Link>
          </Button>
        </section>
      </main>

      <footer className="text-muted-foreground border-t py-8 text-center text-sm">
        {t("footer", { year: new Date().getFullYear() })}
      </footer>
    </div>
  );
}

/** A decorative mock-up of the app, drawn with plain HTML/SVG. */
async function HeroPreview() {
  const t = await getTranslations("landing.preview");
  const locale = await getLocale();
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-md">
      <div className="bg-primary-soft absolute -inset-6 -z-10 rounded-[2rem] blur-2xl" />
      <div className="bg-card rounded-2xl border p-6 shadow-xl">
        <p className="text-muted-foreground text-sm">{t("couple")}</p>
        <p className="mt-1 font-serif text-6xl font-semibold">214</p>
        <p className="text-muted-foreground text-sm">{t("daysToGo")}</p>

        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          {(
            [
              ["86", "attending"],
              ["9", "declined"],
              ["23", "waiting"],
            ] as const
          ).map(([n, label]) => (
            <div key={label} className="bg-muted rounded-lg p-3">
              <p className="font-serif text-2xl font-semibold">{n}</p>
              <p className="text-muted-foreground text-xs">{t(label)}</p>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <div className="flex justify-between gap-2 text-sm">
            <span>{t("budget")}</span>
            <span className="text-muted-foreground">
              {t("budgetOf", {
                spent: fmtMoney(18400, "EUR", locale),
                total: fmtMoney(25000, "EUR", locale),
              })}
            </span>
          </div>
          <div className="bg-muted mt-2 h-2 rounded-full">
            <div className="bg-primary h-2 w-[74%] rounded-full" />
          </div>
        </div>

        {/* mini seating chart */}
        <svg viewBox="0 0 300 110" className="text-primary mt-6 w-full">
          {[50, 150, 250].map((cx, t) => (
            <g key={cx}>
              <circle cx={cx} cy={55} r={24} className="fill-muted stroke-border" />
              {Array.from({ length: 8 }).map((_, i) => {
                const a = (i / 8) * Math.PI * 2;
                const filled = (i + t) % 3 !== 0;
                return (
                  <circle
                    key={i}
                    cx={cx + Math.cos(a) * 36}
                    cy={55 + Math.sin(a) * 36}
                    r={7}
                    className={filled ? "fill-current" : "fill-card stroke-border"}
                  />
                );
              })}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
