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
import { InsideDialog } from "@/components/landing/inside-dialog";
import { LandingNavbar } from "@/components/landing/navbar";
import { HoverIcon, Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
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
      <LandingNavbar />

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
              <InsideDialog triggerClassName="bg-card/70 backdrop-blur-sm" />
            </div>
          </div>
          <Reveal
            immediate
            delay={0.15}
            className="mx-auto mt-10 max-w-2xl px-4 text-center sm:px-6"
          >
            <p className="text-muted-foreground text-lg leading-relaxed">{t("intro")}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3 sm:hidden">
              <Button asChild size="lg">
                <Link href="/login">{t("start")}</Link>
              </Button>
              <InsideDialog />
            </div>
          </Reveal>
        </section>

        {/* Features */}
        <section id="features" className="bg-blush/35 py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal>
              <p className="font-script text-primary-ink text-center text-5xl" aria-hidden>
                Vow
              </p>
              <h2 className="mt-2 text-center text-4xl font-light sm:text-5xl">
                {t("featuresTitle")}
              </h2>
              <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-center leading-relaxed">
                {t("featuresText")}
              </p>
            </Reveal>
            <Stagger
              as="ul"
              stagger={0.06}
              className="bg-border mt-16 grid gap-px overflow-hidden rounded-lg border sm:grid-cols-2 lg:grid-cols-3"
            >
              {FEATURES.map(({ icon: Icon, key }) => (
                <StaggerItem
                  as="li"
                  key={key}
                  whileHover="hover"
                  className="bg-card hover:bg-primary-soft/40 p-8 transition-colors duration-300"
                >
                  <HoverIcon className="mb-5">
                    <Icon className="text-primary-ink size-6" aria-hidden />
                  </HoverIcon>
                  <h3 className="text-2xl">{t(`features.${key}.title`)}</h3>
                  <p className="text-muted-foreground mt-2 leading-relaxed">
                    {t(`features.${key}.text`)}
                  </p>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </section>

        {/* Closing call to action */}
        <section className="bg-sand/50 px-4 py-28 text-center sm:px-6">
          <Reveal className="mx-auto max-w-3xl">
            <h2 className="text-4xl font-light sm:text-5xl">{t("closingTitle")}</h2>
            <p className="text-muted-foreground mt-5 leading-relaxed">{t("closingText")}</p>
            <Button asChild size="lg" className="mt-10">
              <Link href="/login">{t("create")}</Link>
            </Button>
          </Reveal>
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
