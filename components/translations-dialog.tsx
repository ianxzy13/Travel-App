"use client";

import { useEffect, useState, useTransition } from "react";
import { Languages, Loader2, Wand2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";
import type { Translations } from "@/lib/database.types";
import { localeInfo } from "@/i18n/locales";
import { browserTranslate, canBrowserTranslate } from "@/lib/i18n/browser-translate";

export type TranslatableField = { key: string; label: string; multiline?: boolean; max?: number };

/**
 * "Translations" button + dialog: one box per extra language for each text
 * field, with the main-language text shown as a guide. Empty boxes fall
 * back to the main language on guest pages.
 */
export function TranslationsDialog({
  title,
  fields,
  source,
  mainLanguage,
  languages,
  value,
  onSave,
  disabled,
  compact,
}: {
  title: string;
  fields: TranslatableField[];
  /** the main-language texts, by field key */
  source: Record<string, string | null | undefined>;
  mainLanguage: string;
  /** the other languages to translate into */
  languages: string[];
  value: Translations;
  onSave: (translations: Translations) => Promise<ActionResult>;
  disabled?: boolean;
  /** icon-only trigger */
  compact?: boolean;
}) {
  const t = useTranslations("app.translate");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Translations>(value);
  const [pending, startTransition] = useTransition();
  const [drafting, setDrafting] = useState<string | null>(null);
  const [machine, setMachine] = useState(false);
  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);
  useEffect(() => {
    setMachine(canBrowserTranslate());
  }, []);

  if (!languages.length) return null;
  const filled = languages.filter((l) =>
    fields.some((f) => String(value[l]?.[f.key] ?? "").trim()),
  ).length;
  const set = (lang: string, key: string, text: string) =>
    setDraft((d) => ({ ...d, [lang]: { ...d[lang], [key]: text } }));

  async function draftWithBrowser(lang: string) {
    setDrafting(lang);
    try {
      for (const f of fields) {
        const src = source[f.key]?.trim();
        if (!src || String(draft[lang]?.[f.key] ?? "").trim()) continue;
        set(lang, f.key, await browserTranslate(src, mainLanguage, lang));
      }
    } catch {
      toast.error(t("draftFailed"));
    } finally {
      setDrafting(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={compact ? "icon-sm" : "sm"}
          disabled={disabled}
          aria-label={compact ? t("button") : undefined}
        >
          <Languages aria-hidden />
          {!compact && (
            <>
              {t("button")}{" "}
              <span className="text-muted-foreground text-xs">
                {filled}/{languages.length}
              </span>
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {t("hint", { language: localeInfo(mainLanguage).native })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          {languages.map((lang) => (
            <fieldset key={lang} className="space-y-3 rounded-lg border p-3" lang={lang}>
              <legend className="flex w-full items-center justify-between gap-2 px-1 text-sm font-medium">
                {localeInfo(lang).native}
                {machine && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => draftWithBrowser(lang)}
                    disabled={!!drafting}
                  >
                    {drafting === lang ? (
                      <Loader2 className="animate-spin" aria-hidden />
                    ) : (
                      <Wand2 aria-hidden />
                    )}{" "}
                    {t("draft")}
                  </Button>
                )}
              </legend>
              {fields.map((f) => {
                const src = source[f.key] ?? "";
                if (!src.trim()) return null;
                const id = `tr-${lang}-${f.key}`;
                const props = {
                  id,
                  value: String(draft[lang]?.[f.key] ?? ""),
                  placeholder: src,
                  maxLength: f.max ?? 2000,
                  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                    set(lang, f.key, e.target.value),
                };
                return (
                  <div key={f.key} className="space-y-1.5">
                    <Label htmlFor={id} className="text-muted-foreground text-xs">
                      {f.label}
                    </Label>
                    {f.multiline ? <Textarea rows={3} {...props} /> : <Input {...props} />}
                  </div>
                );
              })}
            </fieldset>
          ))}
          {!machine && <p className="text-muted-foreground text-xs">{t("noMachine")}</p>}
        </div>
        <DialogFooter>
          <Button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await onSave(draft);
                if (!r.ok) return void toast.error(r.error);
                toast.success(t("saved"));
                setOpen(false);
              })
            }
          >
            {pending && <Loader2 className="animate-spin" aria-hidden />} {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
