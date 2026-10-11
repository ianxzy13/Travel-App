import type { Metadata } from "next";
import Link from "next/link";
import {
  Armchair,
  BedDouble,
  Bus,
  CalendarHeart,
  Check,
  CheckCircle2,
  ClipboardList,
  Globe,
  Images,
  Landmark,
  Languages,
  MailCheck,
  MapPin,
  Minus,
  Plane,
  Users,
  Wallet,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AppLanguagePicker } from "@/components/app-language-picker";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

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

const DIFFERENCE_CARDS = [
  { icon: Plane, key: "trip" },
  { icon: ClipboardList, key: "entry" },
  { icon: BedDouble, key: "rooms" },
  { icon: Bus, key: "shuttle" },
  { icon: MapPin, key: "paperwork" },
  { icon: Languages, key: "languages" },
] as const;

const COMPARE_KEYS = [
  "tripPage",
  "entryChecklist",
  "roomsPerGuest",
  "paperwork",
  "guestLanguages",
  "dualBudget",
  "familyRoles",
] as const;

type CompareKey = (typeof COMPARE_KEYS)[number];

const COMPARE_ROWS: { key: CompareKey; vow: "yes" | "soon" }[] = [
  { key: "tripPage", vow: "yes" },
  { key: "entryChecklist", vow: "yes" },
  { key: "roomsPerGuest", vow: "yes" },
  { key: "paperwork", vow: "yes" },
  { key: "guestLanguages", vow: "yes" },
  { key: "dualBudget", vow: "yes" },
  { key: "familyRoles", vow: "soon" },
];

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
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pt-4 pb-24 sm:px-6 lg:pt-10">
          <div className="grid items-center lg:grid-cols-12">
            <div className="soft-photo relative h-72 overflow-hidden rounded-lg sm:h-96 lg:col-span-8 lg:col-start-5 lg:row-start-1 lg:h-[36rem]">
              <div className="absolute inset-0 hidden items-center justify-end pe-10 lg:flex xl:pe-16">
                <HeroMock />
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
                  <a href="#difference">{t("seeInside")}</a>
                </Button>
              </div>
            </div>
          </div>
          {/* Mobile mock (shown below the card on small screens) */}
          <div className="mt-8 flex justify-center lg:hidden">
            <HeroMock />
          </div>
        </section>

        {/* What other wedding apps don't do */}
        <section id="difference" className="bg-blush/35 py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <p className="font-script text-primary-ink text-center text-5xl" aria-hidden>
              Vow
            </p>
            <h2 className="mt-2 text-center text-4xl font-light sm:text-5xl">
              {t("differenceTitle")}
            </h2>
            <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-center leading-relaxed">
              {t("differenceText")}
            </p>
            <ul className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {DIFFERENCE_CARDS.map(({ icon: Icon, key }) => (
                <li key={key} className="bg-card rounded-lg border p-8">
                  <Icon className="text-primary-ink mb-5 size-6" aria-hidden />
                  <h3 className="text-2xl">{t(`difference.${key}.title`)}</h3>
                  <p className="text-muted-foreground mt-2 leading-relaxed">
                    {t(`difference.${key}.text`)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Comparison table */}
        <section className="py-24">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <h2 className="text-center text-4xl font-light sm:text-5xl">
              {t("compareTitle")}
            </h2>
            <div className="mt-12 overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="px-4 py-3 text-start font-medium" />
                    <th className="text-primary-ink px-4 py-3 text-center font-medium">
                      {t("compare.vow")}
                    </th>
                    <th className="text-muted-foreground px-4 py-3 text-center font-medium">
                      {t("compare.others")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {COMPARE_ROWS.map(({ key, vow }) => (
                    <tr key={key} className="hover:bg-muted/30">
                      <td className="px-4 py-3">{t(`compare.${key}`)}</td>
                      <td className="px-4 py-3 text-center">
                        {vow === "yes" ? (
                          <Check className="text-success mx-auto size-5" aria-label={t("compare.yes")} />
                        ) : (
                          <span className="text-muted-foreground text-xs">{t("compare.soon")}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Minus className="text-muted-foreground/50 mx-auto size-5" aria-label={t("compare.no")} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* And everything else you'd expect */}
        <section id="features" className="bg-blush/35 py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-4xl font-light sm:text-5xl">
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

        {/* Closing CTA */}
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

async function HeroMock() {
  const t = await getTranslations("landing.mock");
  return (
    <div aria-hidden className="relative w-full max-w-xs">
      <div className="bg-card/95 rounded-2xl border p-5 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-serif text-lg">{t("yourTrip")}</h3>
          <span className="bg-muted rounded-full px-2.5 py-0.5 text-[11px] font-medium">
            🇸🇮 {t("langLabel")}
          </span>
        </div>

        <p className="text-primary-ink font-serif text-xl font-medium">{t("guestName")}</p>

        <ul className="mt-4 space-y-3">
          <li className="flex items-start gap-3">
            <Plane className="text-primary-ink mt-0.5 size-4 shrink-0" />
            <div className="text-sm">
              <p className="font-medium">{t("flight")}</p>
              <p className="text-muted-foreground text-xs">{t("flightDetail")}</p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <BedDouble className="text-primary-ink mt-0.5 size-4 shrink-0" />
            <p className="text-sm">{t("hotel")}</p>
          </li>
          <li className="flex items-start gap-3">
            <Bus className="text-primary-ink mt-0.5 size-4 shrink-0" />
            <p className="text-sm">{t("shuttle")}</p>
          </li>
          <li className="flex items-start gap-3">
            <Armchair className="text-primary-ink mt-0.5 size-4 shrink-0" />
            <p className="text-sm">{t("table")}</p>
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle2 className="text-success mt-0.5 size-4 shrink-0" />
            <p className="text-sm">{t("passport")}</p>
          </li>
        </ul>
      </div>
    </div>
  );
}
