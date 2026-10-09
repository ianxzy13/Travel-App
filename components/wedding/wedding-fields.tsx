"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Controller, type UseFormReturn } from "react-hook-form";
import { Check } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { currencyLabel } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import { ACCENTS, CURRENCIES, STYLE_TAGS, type WeddingFormValues } from "@/lib/validation/wedding";
import { searchLocations, type WeddingLocation } from "@/lib/wedding/locations";

// Each group of fields is its own component so the onboarding wizard can
// show one group per step while the settings page shows them all.

type Props = { form: UseFormReturn<WeddingFormValues>; disabled?: boolean };

export function NamesFields({ form, disabled }: Props) {
  const t = useTranslations("weddingForm");
  const { errors } = form.formState;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField id="partnerAName" label={t("partnerA")} error={errors.partnerAName?.message}>
        {(aria) => (
          <Input
            {...aria}
            autoComplete="given-name"
            placeholder={t("partnerAPlaceholder")}
            disabled={disabled}
            {...form.register("partnerAName")}
          />
        )}
      </FormField>
      <FormField id="partnerBName" label={t("partnerB")} error={errors.partnerBName?.message}>
        {(aria) => (
          <Input
            {...aria}
            placeholder={t("partnerBPlaceholder")}
            disabled={disabled}
            {...form.register("partnerBName")}
          />
        )}
      </FormField>
    </div>
  );
}

function LocationInput({
  value,
  onChange,
  disabled,
  placeholder,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder: string;
  id: string;
}) {
  const [suggestions, setSuggestions] = useState<WeddingLocation[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      onChange(val);
      const results = searchLocations(val);
      setSuggestions(results);
      setOpen(results.length > 0);
      setActiveIdx(-1);
    },
    [onChange],
  );

  const pick = useCallback(
    (loc: WeddingLocation) => {
      onChange(`${loc.city}, ${loc.country}`);
      setOpen(false);
      setSuggestions([]);
    },
    [onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open || suggestions.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => (i + 1) % suggestions.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
      } else if (e.key === "Enter" && activeIdx >= 0) {
        e.preventDefault();
        pick(suggestions[activeIdx]);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    },
    [open, suggestions, activeIdx, pick],
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        id={id}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={open ? `${id}-listbox` : undefined}
        aria-activedescendant={activeIdx >= 0 ? `${id}-opt-${activeIdx}` : undefined}
      />
      {open && suggestions.length > 0 && (
        <ul
          id={`${id}-listbox`}
          role="listbox"
          className="bg-popover text-popover-foreground border-border absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border py-1 shadow-md"
        >
          {suggestions.map((loc, i) => (
            <li
              key={`${loc.city}-${loc.country}`}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === activeIdx}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(loc);
              }}
              onMouseEnter={() => setActiveIdx(i)}
              className={cn(
                "flex cursor-pointer items-baseline gap-2 px-3 py-2 text-sm",
                i === activeIdx && "bg-accent",
              )}
            >
              <span className="font-medium">{loc.city}</span>
              <span className="text-muted-foreground text-xs">{loc.country}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DateLocationFields({ form, disabled }: Props) {
  const t = useTranslations("weddingForm");
  const { errors } = form.formState;
  return (
    <div className="grid gap-4">
      <FormField
        id="weddingDate"
        label={t("date")}
        hint={t("dateHint")}
        error={errors.weddingDate?.message}
      >
        {(aria) => (
          <Input {...aria} type="date" disabled={disabled} {...form.register("weddingDate")} />
        )}
      </FormField>
      <FormField
        id="location"
        label={t("location")}
        hint={t("locationHint")}
        error={errors.location?.message}
      >
        {() => (
          <Controller
            control={form.control}
            name="location"
            render={({ field }) => (
              <LocationInput
                id="location"
                value={field.value}
                onChange={field.onChange}
                disabled={disabled}
                placeholder={t("locationPlaceholder")}
              />
            )}
          />
        )}
      </FormField>
    </div>
  );
}

export function GuestsCurrencyFields({ form, disabled }: Props) {
  const t = useTranslations("weddingForm");
  const locale = useLocale();
  const { errors } = form.formState;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField
        id="estimatedGuests"
        label={t("guests")}
        hint={t("guestsHint")}
        error={errors.estimatedGuests?.message}
      >
        {(aria) => (
          <Input
            {...aria}
            inputMode="numeric"
            placeholder={t("guestsPlaceholder")}
            disabled={disabled}
            {...form.register("estimatedGuests")}
          />
        )}
      </FormField>
      <FormField id="currency" label={t("currency")} error={errors.currency?.message}>
        {(aria) => {
          const TOP_CURRENCIES = ["EUR", "USD", "GBP", "JPY", "CHF", "CAD", "AUD", "CNY", "INR", "BRL"] as const;
          const topSet = new Set<string>(TOP_CURRENCIES);
          const top = TOP_CURRENCIES.map((c) => ({ code: c, label: currencyLabel(c, locale) }));
          const rest = CURRENCIES
            .filter((c) => !topSet.has(c))
            .map((c) => ({ code: c, label: currencyLabel(c, locale) }))
            .sort((a, b) => a.label.localeCompare(b.label, locale));
          return (
            <Controller
              control={form.control}
              name="currency"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
                  <SelectTrigger {...aria} className="w-full">
                    <SelectValue placeholder={t("chooseCurrency")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>{t("popularCurrencies")}</SelectLabel>
                      {top.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel>{t("allCurrencies")}</SelectLabel>
                      {rest.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            />
          );
        }}
      </FormField>
    </div>
  );
}

export function StyleFields({ form, disabled }: Props) {
  const t = useTranslations("weddingForm");
  return (
    <div className="grid gap-6">
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">{t("style")}</legend>
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
                    {t(`styles.${tag}`)}
                  </button>
                );
              })}
            </div>
          )}
        />
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">{t("accent")}</legend>
        <Controller
          control={form.control}
          name="accent"
          render={({ field }) => (
            <div className="flex flex-wrap gap-3" role="radiogroup" aria-label={t("accent")}>
              {ACCENTS.map((a) => (
                <label
                  key={a}
                  data-accent={a}
                  className={cn(
                    "has-[:focus-visible]:ring-ring flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm has-[:focus-visible]:ring-[3px]",
                    field.value === a && "border-primary bg-primary-soft",
                  )}
                >
                  <input
                    type="radio"
                    name={field.name}
                    value={a}
                    checked={field.value === a}
                    onChange={() => field.onChange(a)}
                    disabled={disabled}
                    className="sr-only"
                  />
                  <span className="bg-primary size-5 rounded-full" aria-hidden />
                  {t(`accents.${a}`)}
                </label>
              ))}
            </div>
          )}
        />
      </fieldset>
    </div>
  );
}
