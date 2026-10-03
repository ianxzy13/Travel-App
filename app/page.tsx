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
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 sm:px-6">
        <Logo />
        <nav className="flex flex-wrap items-center gap-2">
          <AppLanguagePicker />
          <Button asChild variant="ghost" className="caps">
            <Link href="/login">{t("signIn")}</Link>
          </Button>
          <Button asChild>
            <Link href="/login">{t("getStarted")}</Link>
          </Button>
        </nav>
      </header>

      <main>
        {/* Hero: a photo-style image with the text card overlapping it, like a magazine */}
        <section className="mx-auto max-w-6xl px-4 pt-4 pb-24 sm:px-6 lg:pt-10">
          <div className="grid items-center lg:grid-cols-12">
            <div className="soft-photo relative h-72 overflow-hidden rounded-lg sm:h-96 lg:col-span-8 lg:col-start-5 lg:row-start-1 lg:h-[36rem]">
              <div className="absolute inset-0 hidden items-center justify-end pe-10 lg:flex xl:pe-16">
                <HeroPreview />
              </div>
            </div>
            <div className="bg-card relative z-10 mx-4 -mt-20 rounded-md border p-8 sm:mx-10 sm:p-12 lg:col-span-6 lg:col-start-1 lg:row-start-1 lg:mx-0 lg:mt-0">
              <p className="eyebrow text-primary-ink">{t("eyebrow")}</p>
              <h1 className="mt-5 text-5xl leading-[1.05] font-light text-balance sm:text-6xl">
                {t("title")}
              </h1>
              <p className="text-muted-foreground mt-6 max-w-lg text-lg leading-relaxed">
                {t("intro")}
              </p>
              <div className="mt-10 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href="/login">{t("start")}</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <a href="#features">{t("seeInside")}</a>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="bg-blush/35 py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <p className="font-script text-primary-ink text-center text-5xl" aria-hidden>
              Vow
            </p>
            <h2 className="mt-2 text-center text-4xl font-light sm:text-5xl">
              {t("featuresTitle")}
            </h2>
            <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-center leading-relaxed">
              {t("featuresText")}
            </p>
            <ul className="bg-border mt-16 grid gap-px overflow-hidden rounded-lg border sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, key }) => (
                <li key={key} className="bg-card p-8">
                  <Icon className="text-primary-ink mb-5 size-6" aria-hidden />
                  <h3 className="text-2xl">{t(`features.${key}.title`)}</h3>
                  <p className="text-muted-foreground mt-2 leading-relaxed">
                    {t(`features.${key}.text`)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Closing call to action */}
        <section className="bg-sand/50 px-4 py-28 text-center sm:px-6">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-4xl font-light sm:text-5xl">{t("closingTitle")}</h2>
            <p className="text-muted-foreground mt-5 leading-relaxed">{t("closingText")}</p>
            <Button asChild size="lg" className="mt-10">
              <Link href="/login">{t("create")}</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="caps text-muted-foreground space-y-2 border-t py-10 text-center">
        <p>{t("footer", { year: new Date().getFullYear() })}</p>
        <p className="text-xs normal-case">
          <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
            {t("privacy")}
          </Link>
          {" · "}
          <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
            {t("terms")}
          </Link>
        </p>
      </footer>
    </div>
  );
}

/** A decorative mock-up of the app, drawn with plain HTML/SVG. */
async function HeroPreview() {
  const t = await getTranslations("landing.preview");
  const locale = await getLocale();
  return (
    <div aria-hidden className="relative w-full max-w-sm">
      <div className="bg-card/95 rounded-md border p-6 shadow-lg">
        <p className="font-script text-3xl">{t("couple")}</p>
        <p className="mt-2 font-serif text-6xl font-light">214</p>
        <p className="eyebrow">{t("daysToGo")}</p>

        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          {(
            [
              ["86", "attending"],
              ["9", "declined"],
              ["23", "waiting"],
            ] as const
          ).map(([n, label]) => (
            <div key={label} className="bg-muted rounded-lg p-3">
              <p className="font-serif text-2xl font-medium">{n}</p>
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
        <svg viewBox="0 0 300 110" className="text-primary-ink mt-6 w-full">
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
