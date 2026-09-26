"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
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
  {
    title: "Who's getting married?",
    text: "Congratulations! Let's start with your names.",
    fields: ["partnerAName", "partnerBName"],
    Fields: NamesFields,
  },
  {
    title: "When and where?",
    text: "It's fine if you don't know yet.",
    fields: ["weddingDate", "location"],
    Fields: DateLocationFields,
  },
  {
    title: "How big is the party?",
    text: "This helps us plan your budget and seating.",
    fields: ["estimatedGuests", "currency"],
    Fields: GuestsCurrencyFields,
  },
  {
    title: "What's your vibe?",
    text: "We'll use this for inspiration and website suggestions.",
    fields: ["styleTags", "accent"],
    Fields: StyleFields,
  },
] as const satisfies readonly {
  title: string;
  text: string;
  fields: readonly (keyof WeddingFormValues)[];
  Fields: unknown;
}[];

export function OnboardingWizard() {
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
      <ol className="mb-6 flex gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li
            key={s.title}
            aria-current={i === step ? "step" : undefined}
            className={cn("h-1.5 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-border")}
          >
            <span className="sr-only">
              Step {i + 1} of {STEPS.length}: {s.title}
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
            <p className="text-muted-foreground text-sm">
              Step {step + 1} of {STEPS.length}
            </p>
            <h1 className="mt-1 text-4xl">{current.title}</h1>
            <p className="text-muted-foreground mt-2 mb-8">{current.text}</p>

            <current.Fields form={form} disabled={pending} />

            <div className="mt-10 flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep((s) => s - 1)}
                className={cn(step === 0 && "invisible")}
                disabled={pending}
              >
                <ArrowLeft aria-hidden /> Back
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" aria-hidden />}
                {isLast ? "Create our wedding" : "Continue"}
                {!isLast && <ArrowRight aria-hidden />}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
