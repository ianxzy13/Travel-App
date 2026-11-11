import Link from "next/link";
import { Gem } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { FREE_LIMITS, planFor, type Feature } from "@/lib/billing/plans";

/** A quiet box where a paid feature would be: what it is and where to get it. */
export function UpgradeNote({ feature }: { feature: Feature }) {
  const t = useTranslations("billing");
  const plan = planFor(feature) === "plus" ? "Vow Plus" : "Vow Pro";
  return (
    <div className="bg-card flex flex-col gap-4 rounded-md border border-dashed px-6 py-8 sm:flex-row sm:items-center">
      <span className="bg-primary-soft text-primary-ink inline-flex size-12 shrink-0 items-center justify-center rounded-full">
        <Gem className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="eyebrow">{plan}</p>
        <p className="text-muted-foreground mt-1 max-w-md text-sm">
          {t(`locked.${feature}`, { plan, guests: FREE_LIMITS.guests })}
        </p>
      </div>
      <Button asChild variant="outline">
        <Link href={`/app/billing?need=${feature}`}>{t("seePlans")}</Link>
      </Button>
    </div>
  );
}
