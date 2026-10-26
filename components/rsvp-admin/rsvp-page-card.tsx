"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { updateRsvpPage } from "@/app/app/rsvp/actions";
import { saveWeddingTranslations } from "@/app/app/settings/language-actions";
import { FormField } from "@/components/form-field";
import { TranslationsDialog } from "@/components/translations-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ImageSlot } from "@/components/website/editor/image-slot";
import type { Translations } from "@/lib/database.types";
import { rsvpPageSchema, type RsvpPageValues } from "@/lib/validation/rsvp";

export type RsvpPageSetup = {
  weddingId: string;
  values: RsvpPageValues;
  /** temporary link to show the current cover photo */
  coverUrl: string | null;
  translations: Translations;
};

/** "Your RSVP page": the couple's cover photo and their own messages to guests. */
export function RsvpPageCard({
  page,
  languages,
  readOnly,
}: {
  page: RsvpPageSetup;
  /** the wedding's languages, main first */
  languages: string[];
  readOnly: boolean;
}) {
  const t = useTranslations("rsvpAdmin.page");
  const [pending, startTransition] = useTransition();
  const [coverUrl, setCoverUrl] = useState(page.coverUrl);
  const form = useForm({ resolver: zodResolver(rsvpPageSchema), defaultValues: page.values });
  const { errors } = form.formState;
  const coverPath = form.watch("coverPath");
  const texts = form.watch(["welcome", "thanks", "sorry"]);

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await updateRsvpPage(values);
      if (result.ok) {
        toast.success(t("saved"));
        form.reset(values);
      } else toast.error(result.error);
    }),
  );

  const textBox = (name: "welcome" | "thanks" | "sorry") => (
    <FormField
      id={`rsvp-page-${name}`}
      label={t(name)}
      hint={t(`${name}Hint`)}
      error={errors[name]?.message}
    >
      {(aria) => (
        <Textarea
          {...aria}
          rows={3}
          maxLength={1000}
          placeholder={t(`${name}Placeholder`)}
          disabled={readOnly}
          {...form.register(name)}
        />
      )}
    </FormField>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-2xl">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("cover")}</p>
            <ImageSlot
              weddingId={page.weddingId}
              folder="rsvp"
              path={coverPath || null}
              url={coverUrl}
              label={t("coverAdd")}
              aspect="aspect-[2/1]"
              disabled={readOnly}
              onChange={(next) => {
                form.setValue("coverPath", next?.path ?? "", { shouldDirty: true });
                setCoverUrl(next?.url ?? null);
              }}
            />
            <p className="text-muted-foreground text-xs">{t("coverHint")}</p>
          </div>
          {textBox("welcome")}
          {textBox("thanks")}
          {textBox("sorry")}
          {!readOnly && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              {languages.length > 1 && (
                <TranslationsDialog
                  title={t("translate")}
                  fields={[
                    { key: "rsvp_welcome", label: t("welcome"), multiline: true, max: 1000 },
                    { key: "rsvp_thanks", label: t("thanks"), multiline: true, max: 1000 },
                    { key: "rsvp_sorry", label: t("sorry"), multiline: true, max: 1000 },
                  ]}
                  source={{ rsvp_welcome: texts[0], rsvp_thanks: texts[1], rsvp_sorry: texts[2] }}
                  mainLanguage={languages[0]}
                  languages={languages.slice(1)}
                  value={page.translations}
                  onSave={saveWeddingTranslations}
                />
              )}
              <Button
                type="submit"
                className="ms-auto"
                disabled={pending || !form.formState.isDirty}
              >
                {pending && <Loader2 className="animate-spin" aria-hidden />}
                {t("save")}
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
