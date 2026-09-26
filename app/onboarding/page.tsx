import type { Metadata } from "next";
import Link from "next/link";
import { OnboardingWizard } from "@/components/onboarding/wizard";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { getWeddingContext } from "@/lib/wedding";

export const metadata: Metadata = { title: "Create your wedding" };

export default async function OnboardingPage() {
  // Existing users can come here to add another wedding (e.g. planners).
  const ctx = await getWeddingContext();

  return (
    <main className="bg-muted/40 min-h-dvh">
      <header className="mx-auto flex max-w-2xl items-center justify-between px-4 py-5">
        <Logo href={ctx ? "/app" : "/"} />
        {ctx && (
          <Button asChild variant="ghost" size="sm">
            <Link href="/app">Back to dashboard</Link>
          </Button>
        )}
      </header>
      <div className="mx-auto max-w-2xl px-4 pb-16">
        <OnboardingWizard />
      </div>
    </main>
  );
}
