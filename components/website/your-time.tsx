"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { zonedToInstant } from "@/lib/i18n/format";

/**
 * "(09:00 your time)" under an event time, only for guests whose own time
 * zone is different from the venue's. Worked out in the visitor's browser.
 */
export function YourTime({
  date,
  time,
  timeZone,
}: {
  date: string;
  time: string;
  timeZone: string;
}) {
  const t = useTranslations("common");
  const locale = useLocale();
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    const mine = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!mine || mine === timeZone) return;
    try {
      const at = zonedToInstant(date, time, timeZone);
      const venue = new Intl.DateTimeFormat(locale, {
        timeZone,
        dateStyle: "short",
        timeStyle: "short",
      }).format(at);
      const local = new Intl.DateTimeFormat(locale, {
        timeZone: mine,
        dateStyle: "short",
        timeStyle: "short",
      }).format(at);
      if (venue === local) return;
      // show the date only when it differs (e.g. overnight for guests in the Americas)
      const sameDay =
        new Intl.DateTimeFormat("en-CA", { timeZone, dateStyle: "short" }).format(at) ===
        new Intl.DateTimeFormat("en-CA", { timeZone: mine, dateStyle: "short" }).format(at);
      const shown = sameDay
        ? new Intl.DateTimeFormat(locale, { timeZone: mine, timeStyle: "short" }).format(at)
        : new Intl.DateTimeFormat(locale, {
            timeZone: mine,
            weekday: "short",
            hour: "numeric",
            minute: "2-digit",
          }).format(at);
      setText(t("yourTime", { time: shown }));
    } catch {
      // unknown time zone: just don't show the hint
    }
  }, [date, time, timeZone, locale, t]);

  if (!text) return null;
  return <span className="block text-xs opacity-75">({text})</span>;
}
