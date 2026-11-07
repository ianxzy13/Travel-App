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
import { LandingCompare } from "@/components/landing/compare";
import { LandingDifference } from "@/components/landing/difference";
import { LandingFacts } from "@/components/landing/facts";
import { LandingFaq } from "@/components/landing/faq";
import { LandingHero } from "@/components/landing/hero";
import { LanguageMarquee } from "@/components/landing/language-marquee";
import { LandingNavbar } from "@/components/landing/navbar";
import { LandingPricing } from "@/components/landing/pricing";
import { HoverIcon, Reveal, SettleIn, Stagger, StaggerItem } from "@/components/motion/reveal";
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
        {/* 1. Headline, call to action and a guest's trip page coming to life */}
        <LandingHero />

        {/* 2. "Welcome" in every language guests can use */}
        <LanguageMarquee />

        {/* 3. What other wedding apps don't do (id="features" for the menu link) */}
        <LandingDifference />

        {/* 4. Facts instead of testimonials */}
        <LandingFacts />

        {/* 5. Vow next to typical apps */}
        <LandingCompare />

        {/* 6. Everything else */}
        <section id="all-features" className="bg-blush/35 scroll-mt-20 border-y py-20 lg:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal>
              <h2 className="text-center text-4xl font-light sm:text-5xl">{t("featuresTitle")}</h2>
              <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-center text-lg leading-relaxed">
                {t("featuresText")}
              </p>
            </Reveal>
            <Stagger
              as="ul"
              stagger={0.06}
              className="bg-border mt-16 grid gap-px overflow-hidden rounded-lg border sm:grid-cols-2 lg:grid-cols-5"
            >
              {FEATURES.map(({ icon: Icon, key }) => (
                <StaggerItem
                  as="li"
                  key={key}
                  hoverGroup
                  className="bg-card hover:bg-primary-soft/40 p-6 transition-colors duration-300"
                >
                  <HoverIcon className="mb-4">
                    <Icon className="text-primary-ink size-6" aria-hidden />
                  </HoverIcon>
                  <h3 className="text-xl font-medium">{t(`features.${key}.title`)}</h3>
                  <p className="text-muted-foreground mt-2 leading-relaxed">
                    {t(`features.${key}.text`)}
                  </p>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </section>

        {/* 7. Pricing: one free plan */}
        <LandingPricing />

        {/* 8. Questions */}
        <LandingFaq />

        {/* 9. Closing: the Vow picture settles in, then the invitation to start */}
        <section className="border-t">
          <div className="overflow-hidden">
            <SettleIn onView>
              <Image
                src="/landing/hero.jpg"
                alt=""
                width={1920}
                height={1080}
                sizes="100vw"
                className="aspect-[16/7] w-full object-cover"
              />
            </SettleIn>
          </div>
          <Reveal className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
            <h2 className="text-4xl font-light sm:text-5xl">{t("closingTitle")}</h2>
            <p className="text-muted-foreground mt-6 text-lg leading-relaxed">{t("closingText")}</p>
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
