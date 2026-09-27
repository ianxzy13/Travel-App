"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowUp, Loader2, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { saveWeddingTranslations, updateLanguages } from "@/app/app/settings/language-actions";
import { TranslationsDialog } from "@/components/translations-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { LOCALES, localeInfo } from "@/i18n/locales";
import type { Translations } from "@/lib/database.types";

/** The wedding's languages (for the website, RSVP pages and emails) and the venue's time zone. */
export function LanguagesCard({
  languages: initial,
  timeZone: initialTz,
  translations,
  location,
  rsvpContact,
  readOnly,
}: {
  languages: string[];
  timeZone: string | null;
  translations: Translations;
  location: string | null;
  rsvpContact: string | null;
  readOnly: boolean;
}) {
  const t = useTranslations("app.languages");
  const [languages, setLanguages] = useState(initial);
  const [timeZone, setTimeZone] = useState(initialTz ?? "");
  const [adding, setAdding] = useState("");
  const [pending, startTransition] = useTransition();
  const zones = useMemo(() => {
    try {
      return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf(
        "timeZone",
      );
    } catch {
      return [];
    }
  }, []);
  const dirty = languages.join() !== initial.join() || timeZone !== (initialTz ?? "");
  const available = LOCALES.filter((l) => !languages.includes(l.code));

  function save() {
    startTransition(async () => {
      const r = await updateLanguages({ languages, timeZone });
      if (r.ok) toast.success(t("saved"));
      else toast.error(r.error);
    });
  }

  return (
    <Card id="languages" className="scroll-mt-20">
      <CardHeader>
        <CardTitle className="font-serif text-2xl">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium">{t("languages")}</p>
          <ol className="divide-y rounded-lg border">
            {languages.map((code, i) => (
              <li key={code} className="flex items-center gap-2 px-3 py-2" lang={code}>
                <span className="flex-1">
                  {localeInfo(code).native}{" "}
                  <span className="text-muted-foreground text-xs" lang="en">
                    {localeInfo(code).english}
                  </span>
                </span>
                {i === 0 ? (
                  <Badge variant="secondary">{t("main")}</Badge>
                ) : (
                  !readOnly && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setLanguages((l) => [code, ...l.filter((x) => x !== code)])}
                    >
                      <ArrowUp aria-hidden /> {t("makeMain")}
                    </Button>
                  )
                )}
                {!readOnly && languages.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("remove", { language: localeInfo(code).native })}
                    onClick={() => setLanguages((l) => l.filter((x) => x !== code))}
                  >
                    <X aria-hidden />
                  </Button>
                )}
              </li>
            ))}
          </ol>
          {!readOnly && available.length > 0 && (
            <div className="flex gap-2">
              <Label htmlFor="add-language" className="sr-only">
                {t("add")}
              </Label>
              <select
                id="add-language"
                value={adding}
                onChange={(e) => setAdding(e.target.value)}
                className="border-input bg-background h-9 flex-1 rounded-md border px-2 text-sm"
              >
                <option value="">{t("choose")}</option>
                {available.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.native} – {l.english}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!adding}
                onClick={() => {
                  setLanguages((l) => [...l, adding]);
                  setAdding("");
                }}
              >
                <Plus aria-hidden /> {t("add")}
              </Button>
            </div>
          )}
          <p className="text-muted-foreground text-xs">{t("help")}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="time-zone">{t("timeZone")}</Label>
          <div className="flex flex-wrap gap-2">
            <select
              id="time-zone"
              value={timeZone}
              disabled={readOnly}
              onChange={(e) => setTimeZone(e.target.value)}
              className="border-input bg-background h-9 min-w-0 flex-1 rounded-md border px-2 text-sm"
            >
              <option value="">{t("noTimeZone")}</option>
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            {!readOnly && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone)}
              >
                {t("useMine")}
              </Button>
            )}
          </div>
          <p className="text-muted-foreground text-xs">{t("timeZoneHelp")}</p>
        </div>

        {!readOnly && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TranslationsDialog
              title={t("translateDetails")}
              fields={[
                { key: "location", label: t("location"), max: 300 },
                { key: "rsvp_contact", label: t("rsvpContact"), max: 300 },
              ]}
              source={{ location, rsvp_contact: rsvpContact }}
              mainLanguage={initial[0]}
              languages={initial.slice(1)}
              value={translations}
              onSave={saveWeddingTranslations}
            />
            <Button type="button" onClick={save} disabled={!dirty || pending} className="ms-auto">
              {pending && <Loader2 className="animate-spin" aria-hidden />} {t("save")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
