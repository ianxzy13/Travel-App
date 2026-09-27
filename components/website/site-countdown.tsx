"use client";

import { useEffect, useState } from "react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { useTranslations } from "next-intl";

/** "124 days to go" – worked out in the visitor's browser, so it's never stale. */
export function SiteCountdown({ date, big = false }: { date: string | null; big?: boolean }) {
  const t = useTranslations("site.countdown");
  const [days, setDays] = useState<number | null>(null);
  useEffect(() => {
    if (!date) return;
    const update = () => setDays(differenceInCalendarDays(parseISO(date), new Date()));
    update();
    const timer = setInterval(update, 60 * 60 * 1000);
    return () => clearInterval(timer);
  }, [date]);

  if (!date || days == null) return <span className="invisible">…</span>;
  if (days < 0) return <span>{t("married")}</span>;
  if (days === 0) return <span>{t("today")}</span>;
  return big ? (
    <span className="flex items-baseline gap-2">
      <span className="font-[family-name:var(--site-heading)] text-5xl tabular-nums @3xl:text-7xl">
        {days}
      </span>
      <span>{t("daysWord", { count: days })}</span>
    </span>
  ) : (
    <span>{t("days", { count: days })}</span>
  );
}
