import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { OnboardingWizard } from "@/components/onboarding/wizard";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { requireLanguageChoice } from "@/lib/i18n/choice";
import { getWeddingContext } from "@/lib/wedding";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("onboarding"))("metaTitle") };
}

export default async function OnboardingPage() {
  // Existing users can come here to add another wedding (e.g. planners).
  const ctx = await getWeddingContext();
  await requireLanguageChoice("/onboarding");
  const t = await getTranslations("onboarding");

  return (
    <main className="bg-muted/40 min-h-dvh">
      <header className="mx-auto flex max-w-2xl items-center justify-between px-4 py-5">
        <Logo href={ctx ? "/app" : "/"} />
        {ctx && (
          <Button asChild variant="ghost" size="sm">
            <Link href="/app">{t("backToDashboard")}</Link>
          </Button>
        )}
      </header>
      <div className="mx-auto max-w-2xl px-4 pb-16">
        <OnboardingWizard />
      </div>
    </main>
  );
}
