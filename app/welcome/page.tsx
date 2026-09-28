import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Logo } from "@/components/logo";
import { WelcomeLanguages } from "@/components/onboarding/welcome-languages";
import { safeNextPath } from "@/lib/site-url";
import { requireUser } from "@/lib/wedding";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("welcome"))("title") };
}

/** First thing after signing up: pick the language the app speaks. */
export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  await requireUser();
  const next = safeNextPath((await searchParams).next);
  if (next.startsWith("/welcome")) redirect("/app");
  const t = await getTranslations("welcome");
  return (
    <main className="min-h-dvh">
      <header className="mx-auto flex max-w-3xl items-center justify-center px-4 py-8">
        <Logo />
      </header>
      <div className="mx-auto max-w-3xl px-4 pb-16">
        <div aria-hidden className="soft-photo mb-10 h-28 rounded-lg sm:h-36" />
        <h1 className="text-center text-4xl font-light sm:text-5xl">{t("title")}</h1>
        <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-center">{t("intro")}</p>
        <WelcomeLanguages suggested={await getLocale()} next={next} />
        <p className="text-muted-foreground mx-auto mt-10 max-w-xl text-center text-sm">
          {t("guestsNote")}
        </p>
      </div>
    </main>
  );
}
