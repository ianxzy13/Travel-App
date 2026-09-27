"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { setAppLanguage } from "@/app/app/settings/language-actions";
import { Flag } from "@/components/flag";
import { Button } from "@/components/ui/button";
import { LOCALES, localeInfo } from "@/i18n/locales";
import { cn } from "@/lib/utils";

/** A grid of big flag tiles; the suggested language (from the browser) comes first. */
export function WelcomeLanguages({ suggested, next }: { suggested: string; next: string }) {
  const t = useTranslations("welcome");
  const router = useRouter();
  const [picked, setPicked] = useState(suggested);
  const [pending, startTransition] = useTransition();
  const ordered = [...LOCALES].sort((a, b) =>
    a.code === suggested ? -1 : b.code === suggested ? 1 : 0,
  );

  function go() {
    startTransition(async () => {
      await setAppLanguage(picked);
      router.replace(next);
      router.refresh();
    });
  }

  return (
    <>
      <div
        role="radiogroup"
        aria-label={t("title")}
        className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
      >
        {ordered.map((l) => {
          const selected = l.code === picked;
          return (
            <button
              key={l.code}
              type="button"
              role="radio"
              aria-checked={selected}
              lang={l.code}
              onClick={() => {
                setPicked(l.code);
                // show this page in the chosen language straight away
                startTransition(async () => {
                  await setAppLanguage(l.code);
                  router.refresh();
                });
              }}
              className={cn(
                "bg-card hover:border-primary/60 focus-visible:ring-ring relative flex min-h-24 flex-col items-start gap-2 rounded-xl border p-4 text-start transition-colors focus-visible:ring-[3px] focus-visible:outline-none",
                selected && "border-primary ring-primary/30 ring-2",
              )}
            >
              <Flag locale={l.code} className="h-6" />
              <span className="font-medium">{l.native}</span>
              {l.native !== l.english && (
                <span className="text-muted-foreground -mt-1.5 text-xs" lang="en">
                  {l.english}
                </span>
              )}
              {l.code === suggested && (
                <span className="bg-primary-soft text-primary absolute end-2 top-2 rounded-full px-2 py-0.5 text-[0.7rem] font-medium">
                  {t("suggested")}
                </span>
              )}
              {selected && l.code !== suggested && (
                <Check className="text-primary absolute end-3 top-3 size-4" aria-hidden />
              )}
            </button>
          );
        })}
      </div>
      <div className="bg-muted/80 sticky bottom-0 mt-6 -mx-4 flex justify-end px-4 py-4 backdrop-blur">
        <Button size="lg" onClick={go} disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          <Flag locale={picked} />
          {t("continue", { language: localeInfo(picked).native })}
          <ArrowRight className="rtl:rotate-180" aria-hidden />
        </Button>
      </div>
    </>
  );
}
