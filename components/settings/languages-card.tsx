"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { saveWeddingTranslations, updateLanguages } from "@/app/app/settings/language-actions";
import { LanguageName, LanguageSelect } from "@/components/language-select";
import { TranslationsDialog } from "@/components/translations-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type { Translations } from "@/lib/database.types";

/**
 * The couple's own language, the languages their households speak (set per
 * household in Guests) and the venue's time zone.
 */
export function LanguagesCard({
  languages,
  householdCounts,
  timeZone: initialTz,
  translations,
  location,
  rsvpContact,
  readOnly,
}: {
  /** the couple's language first, then the households' languages */
  languages: string[];
  /** households per language (households using the couple's language included) */
  householdCounts: Record<string, number>;
  timeZone: string | null;
  translations: Translations;
  location: string | null;
  rsvpContact: string | null;
  readOnly: boolean;
}) {
  const t = useTranslations("langCard");
  const [language, setLanguage] = useState(languages[0] ?? "en");
  const [timeZone, setTimeZone] = useState(initialTz ?? "");
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
  const guestLanguages = languages.slice(1);
  const dirty = language !== languages[0] || timeZone !== (initialTz ?? "");

  function save() {
    startTransition(async () => {
      const r = await updateLanguages({ language, timeZone });
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
          <Label htmlFor="couple-language">{t("yours")}</Label>
          <LanguageSelect
            id="couple-language"
            label={t("yours")}
            value={language}
            onChange={(code) => code && setLanguage(code)}
            disabled={readOnly}
            className="sm:max-w-xs"
          />
          <p className="text-muted-foreground text-xs">{t("yoursHelp")}</p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">{t("guests")}</p>
          {guestLanguages.length === 0 ? (
            <p className="text-muted-foreground bg-muted/60 rounded-lg p-3 text-sm">
              {t("guestsEmpty")}
            </p>
          ) : (
            <>
              <ul className="flex flex-wrap gap-2">
                {guestLanguages.map((code) => (
                  <li
                    key={code}
                    className="bg-muted/60 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm"
                  >
                    <LanguageName code={code} />
                    <span className="text-muted-foreground text-xs">
                      {t("households", { count: householdCounts[code] ?? 0 })}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-muted-foreground text-xs">{t("guestsHelp")}</p>
            </>
          )}
          <Button asChild variant="outline" size="sm">
            <Link href="/app/guests">
              <Users aria-hidden /> {t("manage")}
            </Link>
          </Button>
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
            {guestLanguages.length > 0 && (
              <TranslationsDialog
                title={t("translateDetails")}
                fields={[
                  { key: "location", label: t("location"), max: 300 },
                  { key: "rsvp_contact", label: t("rsvpContact"), max: 300 },
                ]}
                source={{ location, rsvp_contact: rsvpContact }}
                mainLanguage={languages[0]}
                languages={guestLanguages}
                value={translations}
                onSave={saveWeddingTranslations}
              />
            )}
            <Button type="button" onClick={save} disabled={!dirty || pending} className="ms-auto">
              {pending && <Loader2 className="animate-spin" aria-hidden />} {t("save")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
