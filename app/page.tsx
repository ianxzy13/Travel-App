import type { Metadata } from "next";
import Image from "next/image";
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
        {/* Hero: the Vow picture. It already shows the logo and tagline,
            so the page heading is for screen readers only. */}
        <section className="pb-20">
          <h1 className="sr-only">{t("title")}</h1>
          <div className="relative">
            <Image
              src="/landing/hero.jpg"
              alt=""
              width={1920}
              height={1080}
              priority
              sizes="100vw"
              className="aspect-[4/3] w-full object-cover sm:aspect-auto sm:min-h-[28rem]"
            />
            <div className="absolute inset-x-0 top-[70%] hidden justify-center gap-3 sm:flex">
              <Button asChild size="lg">
                <Link href="/login">{t("start")}</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="bg-card/70 backdrop-blur-sm">
                <a href="#features">{t("seeInside")}</a>
              </Button>
            </div>
          </div>
          <div className="mx-auto mt-10 max-w-2xl px-4 text-center sm:px-6">
            <p className="text-muted-foreground text-lg leading-relaxed">{t("intro")}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3 sm:hidden">
              <Button asChild size="lg">
                <Link href="/login">{t("start")}</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#features">{t("seeInside")}</a>
              </Button>
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
          <Link href="/privacy" className="hover:text-foreground underline underline-offset-2">
            {t("privacy")}
          </Link>
          {" · "}
          <Link href="/terms" className="hover:text-foreground underline underline-offset-2">
            {t("terms")}
          </Link>
        </p>
      </footer>
    </div>
  );
}
