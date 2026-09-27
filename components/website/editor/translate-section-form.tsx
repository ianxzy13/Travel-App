"use client";

import { useState } from "react";
import { Loader2, Wand2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SiteSectionKind } from "@/lib/database.types";
import { browserTranslate, canBrowserTranslate } from "@/lib/i18n/browser-translate";
import { TRANSLATABLE } from "@/lib/i18n/content";

type Obj = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const LONG = new Set(["intro", "notes", "text", "bio", "answer"]);

/**
 * Translating one section: every text of the main language with a box for
 * the other language. Photos, order and the list of items stay as in the main
 * language (change those there).
 */
export function TranslateSectionForm({
  kind,
  content,
  translation,
  onChange,
  mainLanguage,
  language,
  disabled,
}: {
  kind: SiteSectionKind;
  /** main-language content */
  content: Obj;
  /** this language's texts */
  translation: Obj;
  onChange: (next: Obj) => void;
  mainLanguage: string;
  language: string;
  disabled: boolean;
}) {
  const t = useTranslations("app.websiteLang");
  const spec = TRANSLATABLE[kind];
  const [drafting, setDrafting] = useState(false);
  const machine = typeof window !== "undefined" && canBrowserTranslate();

  const setField = (f: string, v: string) => onChange({ ...translation, [f]: v });
  const setItem = (list: string, id: string, f: string, v: string) => {
    const items = (translation[list] ?? {}) as Record<string, Obj>;
    onChange({ ...translation, [list]: { ...items, [id]: { ...items[id], [f]: v } } });
  };

  async function draftAll() {
    setDrafting(true);
    try {
      let next = { ...translation };
      for (const f of spec.fields) {
        const src = str(content[f]).trim();
        if (src && !str(next[f]).trim())
          next = { ...next, [f]: await browserTranslate(src, mainLanguage, language) };
      }
      for (const [list, fields] of Object.entries(spec.lists ?? {})) {
        const items = { ...((next[list] ?? {}) as Record<string, Obj>) };
        for (const item of (content[list] as Obj[]) ?? []) {
          const id = str(item.id);
          for (const f of fields) {
            const src = str(item[f]).trim();
            if (src && !str(items[id]?.[f]).trim())
              items[id] = {
                ...items[id],
                [f]: await browserTranslate(src, mainLanguage, language),
              };
          }
        }
        next = { ...next, [list]: items };
      }
      onChange(next);
    } catch {
      toast.error(t("draftFailed"));
    } finally {
      setDrafting(false);
    }
  }

  const box = (
    id: string,
    label: string,
    source: string,
    value: string,
    set: (v: string) => void,
    long: boolean,
  ) => (
    <div key={id} className="space-y-1.5">
      <Label htmlFor={id} className="text-muted-foreground text-xs">
        {label}
      </Label>
      {long ? (
        <Textarea
          id={id}
          rows={3}
          value={value}
          placeholder={source}
          maxLength={3000}
          disabled={disabled}
          onChange={(e) => set(e.target.value)}
          lang={language}
        />
      ) : (
        <Input
          id={id}
          value={value}
          placeholder={source}
          maxLength={300}
          disabled={disabled}
          onChange={(e) => set(e.target.value)}
          lang={language}
        />
      )}
      {!value.trim() && <p className="text-muted-foreground text-xs">{t("fallback")}</p>}
    </div>
  );

  const fields = spec.fields.filter((f) => str(content[f]).trim());
  const lists = Object.entries(spec.lists ?? {}).filter(
    ([list]) => ((content[list] as Obj[]) ?? []).length,
  );
  if (!fields.length && !lists.length)
    return <p className="text-muted-foreground text-sm">{t("nothing")}</p>;

  return (
    <div className="space-y-4">
      {machine && !disabled && (
        <Button type="button" variant="outline" size="sm" onClick={draftAll} disabled={drafting}>
          {drafting ? <Loader2 className="animate-spin" aria-hidden /> : <Wand2 aria-hidden />}{" "}
          {t("draft")}
        </Button>
      )}
      {fields.map((f) =>
        box(
          `tr-${kind}-${f}`,
          t(`fields.${f}` as "fields.intro"),
          str(content[f]),
          str(translation[f]),
          (v) => setField(f, v),
          LONG.has(f),
        ),
      )}
      {lists.map(([list, itemFields]) => (
        <ol key={list} className="space-y-3">
          {((content[list] as Obj[]) ?? []).map((item, i) => {
            const id = str(item.id);
            const tr = ((translation[list] ?? {}) as Record<string, Obj>)[id] ?? {};
            const present = itemFields.filter((f) => str(item[f]).trim());
            if (!present.length) return null;
            return (
              <li key={id} className="bg-card space-y-2 rounded-lg border p-3">
                <p className="text-muted-foreground text-xs font-medium">
                  {str(item.name) || t("item", { number: i + 1 })}
                </p>
                {present.map((f) =>
                  box(
                    `tr-${kind}-${id}-${f}`,
                    t(`fields.${f}` as "fields.intro"),
                    str(item[f]),
                    str(tr[f]),
                    (v) => setItem(list, id, f, v),
                    LONG.has(f),
                  ),
                )}
              </li>
            );
          })}
        </ol>
      ))}
    </div>
  );
}
