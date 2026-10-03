"use client";

import { useState, useTransition } from "react";
import { CheckSquare, ExternalLink, Square } from "lucide-react";
import { useTranslations } from "next-intl";
import { toggleChecklistItem } from "@/app/r/trip-actions";
import type { RsvpData } from "@/lib/rsvp/types";
import { filterChecklist, SLOVENIA_CHECKLIST, type ChecklistItem } from "@/lib/trip/checklist-data";

export function TripChecklist({ data }: { data: RsvpData }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t: (key: string, values?: Record<string, unknown>) => string = useTranslations("rsvp.trip") as any;
  const country = data.household.country_code;

  const items = filterChecklist(SLOVENIA_CHECKLIST, country);
  const doneMap: Record<string, boolean> = {};
  for (const c of data.checklist ?? []) doneMap[c.item_key] = c.done;

  const [checked, setChecked] = useState<Record<string, boolean>>(doneMap);
  const [pending, startTransition] = useTransition();
  const doneCount = Object.values(checked).filter(Boolean).length;

  if (items.length === 0) return null;

  function toggle(item: ChecklistItem) {
    const next = !checked[item.key];
    setChecked((prev) => ({ ...prev, [item.key]: next }));
    startTransition(async () => {
      try {
        await toggleChecklistItem(data.household.code, item.key, next);
      } catch {
        setChecked((prev) => ({ ...prev, [item.key]: !next }));
      }
    });
  }

  return (
    <section className="bg-card space-y-4 rounded-2xl border p-5 shadow-sm sm:p-7">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xl font-medium">
          <CheckSquare className="size-5" aria-hidden />
          {t("checklistTitle")}
        </h3>
        <span className="text-muted-foreground text-sm">
          {t("checklistProgress", { done: doneCount, total: items.length })}
        </span>
      </div>

      <ul className="space-y-2">
        {items.map((item) => {
          const done = checked[item.key] ?? false;
          return (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => toggle(item)}
                disabled={pending}
                className="flex w-full items-start gap-3 rounded-xl border p-4 text-start transition hover:bg-accent/30 disabled:opacity-60"
              >
                {done ? (
                  <CheckSquare className="text-success mt-0.5 size-5 shrink-0" aria-hidden />
                ) : (
                  <Square className="text-muted-foreground mt-0.5 size-5 shrink-0" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <p className={done ? "line-through opacity-60" : "font-medium"}>
                    {t(item.titleKey)}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-sm">{t(item.descriptionKey)}</p>
                  {item.link && (
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary mt-1 inline-flex items-center gap-1 text-sm underline underline-offset-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {t("learnMore")} <ExternalLink className="size-3" aria-hidden />
                    </a>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="text-muted-foreground text-xs">{t("checklistDisclaimer")}</p>
    </section>
  );
}
