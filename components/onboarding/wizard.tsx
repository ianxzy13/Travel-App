"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createWedding } from "@/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DateLocationFields,
  GuestsCurrencyFields,
  NamesFields,
  StyleFields,
} from "@/components/wedding/wedding-fields";
import { cn } from "@/lib/utils";
import { emptyWedding, weddingSchema, type WeddingFormValues } from "@/lib/validation/wedding";

// Each step lists the fields it validates before moving on.
const STEPS = [
  { key: "names", fields: ["partnerAName", "partnerBName"], Fields: NamesFields },
  { key: "when", fields: ["weddingDate", "location"], Fields: DateLocationFields },
  { key: "size", fields: ["estimatedGuests", "currency"], Fields: GuestsCurrencyFields },
  { key: "style", fields: ["styleTags", "accent"], Fields: StyleFields },
] as const satisfies readonly {
  key: string;
  fields: readonly (keyof WeddingFormValues)[];
  Fields: unknown;
}[];

export function OnboardingWizard() {
  const t = useTranslations("onboarding");
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const form = useForm({ resolver: zodResolver(weddingSchema), defaultValues: emptyWedding });

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  // Preview the chosen accent colour live.
  const accent = form.watch("accent");

  async function next() {
    const valid = await form.trigger([...current.fields]);
    if (valid) setStep((s) => s + 1);
  }

  const submit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await createWedding(values);
      // On success the action redirects, so we only get here on failure.
      if (result && !result.ok) toast.error(result.error);
    }),
  );

  return (
    <div data-accent={accent}>
      {/* progress */}
      <ol className="mb-6 flex gap-2" aria-label={t("progress")}>
        {STEPS.map((s, i) => (
          <li
            key={s.key}
            aria-current={i === step ? "step" : undefined}
            className={cn("h-px flex-1", i <= step ? "bg-primary" : "bg-border")}
          >
            <span className="sr-only">
              {t("stepOfTitle", {
                step: i + 1,
                total: STEPS.length,
                title: t(`steps.${s.key}.title`),
              })}
            </span>
          </li>
        ))}
      </ol>

      <Card>
        <CardContent className="p-6 sm:p-8">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (isLast) submit();
              else next();
            }}
            noValidate
          >
            <p className="eyebrow">{t("stepOf", { step: step + 1, total: STEPS.length })}</p>
            <h1 className="mt-3 text-4xl font-light sm:text-5xl">
              {t(`steps.${current.key}.title`)}
            </h1>
            <p className="text-muted-foreground mt-2 mb-8">{t(`steps.${current.key}.text`)}</p>

            <current.Fields form={form} disabled={pending} />

            <div className="mt-10 flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep((s) => s - 1)}
                className={cn(step === 0 && "invisible")}
                disabled={pending}
              >
                <ArrowLeft className="rtl:rotate-180" aria-hidden /> {t("back")}
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" aria-hidden />}
                {isLast ? t("create") : t("continue")}
                {!isLast && <ArrowRight className="rtl:rotate-180" aria-hidden />}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
