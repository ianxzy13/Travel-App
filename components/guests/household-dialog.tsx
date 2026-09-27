"use client";

import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { updateHousehold } from "@/app/app/guests/actions";
import { FormField } from "@/components/form-field";
import { LanguageSelect } from "@/components/language-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { localeInfo } from "@/i18n/locales";
import { householdSchema } from "@/lib/validation/guest";
import type { HouseholdOption } from "./types";

/** Household settings: name, language (for their website, RSVP page and emails) and address. */
export function HouseholdDialog({
  household,
  coupleLanguage,
  languages,
  onClose,
}: {
  household: HouseholdOption | null;
  coupleLanguage: string;
  /** languages already used by households (listed first) */
  languages: string[];
  onClose: () => void;
}) {
  return (
    <Dialog open={!!household} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        {household && (
          <HouseholdForm
            key={household.id}
            household={household}
            coupleLanguage={coupleLanguage}
            languages={languages}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function HouseholdForm({
  household,
  coupleLanguage,
  languages,
  onClose,
}: {
  household: HouseholdOption;
  coupleLanguage: string;
  languages: string[];
  onClose: () => void;
}) {
  const t = useTranslations("guests.household");
  const s = useTranslations("guests.sheet");
  const [pending, startTransition] = useTransition();
  const form = useForm({
    resolver: zodResolver(householdSchema),
    defaultValues: {
      name: household.name,
      address: household.address,
      language: household.language,
    },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await updateHousehold(household.id, values);
      if (result.ok) {
        toast.success(t("saved"));
        onClose();
      } else {
        toast.error(result.error);
      }
    }),
  );

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-serif text-2xl">{t("title")}</DialogTitle>
        <DialogDescription>{t("description")}</DialogDescription>
      </DialogHeader>
      <form
        id="household-form"
        onSubmit={onSubmit}
        className="grid gap-4 sm:grid-cols-2"
        noValidate
      >
        <FormField
          id="h-name"
          label={t("name")}
          error={errors.name?.message}
          className="sm:col-span-2"
        >
          {(aria) => <Input {...aria} {...form.register("name")} />}
        </FormField>
        <FormField
          id="h-language"
          label={t("language")}
          hint={t("languageHint")}
          className="sm:col-span-2"
        >
          {(aria) => (
            <Controller
              control={form.control}
              name="language"
              render={({ field }) => (
                <LanguageSelect
                  id={aria.id}
                  label={t("language")}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  featured={languages.filter((l) => l !== coupleLanguage)}
                  empty={{ label: t("sameAsOurs", { language: localeInfo(coupleLanguage).native }) }}
                />
              )}
            />
          )}
        </FormField>
        <FormField
          id="h-1"
          label={s("line1")}
          error={errors.address?.line1?.message}
          className="sm:col-span-2"
        >
          {(aria) => <Input {...aria} {...form.register("address.line1")} />}
        </FormField>
        <FormField
          id="h-2"
          label={s("line2")}
          error={errors.address?.line2?.message}
          className="sm:col-span-2"
        >
          {(aria) => <Input {...aria} {...form.register("address.line2")} />}
        </FormField>
        <FormField id="h-city" label={s("city")} error={errors.address?.city?.message}>
          {(aria) => <Input {...aria} {...form.register("address.city")} />}
        </FormField>
        <FormField id="h-region" label={s("region")} error={errors.address?.region?.message}>
          {(aria) => <Input {...aria} {...form.register("address.region")} />}
        </FormField>
        <FormField id="h-zip" label={s("postalCode")} error={errors.address?.postalCode?.message}>
          {(aria) => <Input {...aria} {...form.register("address.postalCode")} />}
        </FormField>
        <FormField id="h-country" label={s("country")} error={errors.address?.country?.message}>
          {(aria) => <Input {...aria} {...form.register("address.country")} />}
        </FormField>
      </form>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={pending}>
          {t("cancel")}
        </Button>
        <Button type="submit" form="household-form" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {t("save")}
        </Button>
      </DialogFooter>
    </>
  );
}
