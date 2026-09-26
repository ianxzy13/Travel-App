"use client";

import { Controller, type UseFormReturn } from "react-hook-form";
import { Check } from "lucide-react";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ACCENTS, CURRENCIES, STYLE_TAGS, type WeddingFormValues } from "@/lib/validation/wedding";

// Each group of fields is its own component so the onboarding wizard can
// show one group per step while the settings page shows them all.

type Props = { form: UseFormReturn<WeddingFormValues>; disabled?: boolean };

export function NamesFields({ form, disabled }: Props) {
  const { errors } = form.formState;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField id="partnerAName" label="Partner one" error={errors.partnerAName?.message}>
        {(aria) => (
          <Input
            {...aria}
            autoComplete="given-name"
            placeholder="e.g. Ian"
            disabled={disabled}
            {...form.register("partnerAName")}
          />
        )}
      </FormField>
      <FormField id="partnerBName" label="Partner two" error={errors.partnerBName?.message}>
        {(aria) => (
          <Input
            {...aria}
            placeholder="e.g. Maria"
            disabled={disabled}
            {...form.register("partnerBName")}
          />
        )}
      </FormField>
    </div>
  );
}

export function DateLocationFields({ form, disabled }: Props) {
  const { errors } = form.formState;
  return (
    <div className="grid gap-4">
      <FormField
        id="weddingDate"
        label="Wedding date"
        hint="Not decided yet? Leave it empty and add it later."
        error={errors.weddingDate?.message}
      >
        {(aria) => (
          <Input {...aria} type="date" disabled={disabled} {...form.register("weddingDate")} />
        )}
      </FormField>
      <FormField
        id="location"
        label="Location"
        hint="City, region or venue, whatever you know so far."
        error={errors.location?.message}
      >
        {(aria) => (
          <Input
            {...aria}
            placeholder="e.g. Sintra, Portugal"
            disabled={disabled}
            {...form.register("location")}
          />
        )}
      </FormField>
    </div>
  );
}

export function GuestsCurrencyFields({ form, disabled }: Props) {
  const { errors } = form.formState;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField
        id="estimatedGuests"
        label="Estimated guests"
        hint="A rough guess is fine."
        error={errors.estimatedGuests?.message}
      >
        {(aria) => (
          <Input
            {...aria}
            inputMode="numeric"
            placeholder="e.g. 120"
            disabled={disabled}
            {...form.register("estimatedGuests")}
          />
        )}
      </FormField>
      <FormField id="currency" label="Currency" error={errors.currency?.message}>
        {(aria) => (
          <Controller
            control={form.control}
            name="currency"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
                <SelectTrigger {...aria} className="w-full">
                  <SelectValue placeholder="Choose a currency" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        )}
      </FormField>
    </div>
  );
}

export function StyleFields({ form, disabled }: Props) {
  return (
    <div className="grid gap-6">
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Style (pick any that feel like you)</legend>
        <Controller
          control={form.control}
          name="styleTags"
          render={({ field }) => (
            <div className="flex flex-wrap gap-2">
              {STYLE_TAGS.map((tag) => {
                const selected = field.value.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={selected}
                    disabled={disabled}
                    onClick={() =>
                      field.onChange(
                        selected ? field.value.filter((t) => t !== tag) : [...field.value, tag],
                      )
                    }
                    className={cn(
                      "focus-visible:ring-ring inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:ring-[3px] focus-visible:outline-none disabled:opacity-50",
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-background hover:bg-accent",
                    )}
                  >
                    {selected && <Check className="size-3.5" aria-hidden />}
                    {tag}
                  </button>
                );
              })}
            </div>
          )}
        />
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Accent colour for the app</legend>
        <Controller
          control={form.control}
          name="accent"
          render={({ field }) => (
            <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Accent colour">
              {ACCENTS.map((a) => (
                <label
                  key={a.value}
                  data-accent={a.value}
                  className={cn(
                    "has-[:focus-visible]:ring-ring flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm has-[:focus-visible]:ring-[3px]",
                    field.value === a.value && "border-primary bg-primary-soft",
                  )}
                >
                  <input
                    type="radio"
                    name={field.name}
                    value={a.value}
                    checked={field.value === a.value}
                    onChange={() => field.onChange(a.value)}
                    disabled={disabled}
                    className="sr-only"
                  />
                  <span className="bg-primary size-5 rounded-full" aria-hidden />
                  {a.label}
                </label>
              ))}
            </div>
          )}
        />
      </fieldset>
    </div>
  );
}
