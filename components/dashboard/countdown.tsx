"use client";

import { useEffect, useState } from "react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { useTranslations } from "next-intl";

/** Big live countdown to the wedding day (in the viewer's own time zone). */
export function Countdown({ date }: { date: string }) {
  // Rendered only in the browser to avoid server/browser time-zone mismatches.
  const t = useTranslations("app.countdown");
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) return <div className="h-[7.5rem]" aria-hidden />;

  const target = parseISO(date); // midnight at the start of the wedding day
  const days = differenceInCalendarDays(target, now);

  if (days === 0) return <Message big={t("today")} small={t("enjoy")} />;
  if (days < 0) {
    const n = -days;
    return <Message big={t("married", { count: n })} small={t("congrats")} />;
  }

  // Time left until midnight at the start of the day, broken into units.
  const msLeft = target.getTime() - now.getTime();
  const hours = Math.floor(msLeft / 3_600_000) % 24;
  const minutes = Math.floor(msLeft / 60_000) % 60;
  const seconds = Math.floor(msLeft / 1000) % 60;

  return (
    <div className="flex flex-wrap items-end gap-x-8 gap-y-3" role="timer" aria-live="off">
      <div>
        <p className="font-serif text-7xl leading-none font-semibold sm:text-8xl">{days}</p>
        <p className="text-muted-foreground mt-1">{t("daysToGo", { count: days })}</p>
      </div>
      <dl className="flex gap-4 pb-1 font-serif text-3xl tabular-nums">
        {[
          [t("hours"), hours],
          [t("minutes"), minutes],
          [t("seconds"), seconds],
        ].map(([label, value]) => (
          <div key={label} className="text-center">
            <dd className="font-semibold">{String(value).padStart(2, "0")}</dd>
            <dt className="text-muted-foreground font-sans text-xs">{label}</dt>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Message({ big, small }: { big: string; small: string }) {
  return (
    <div>
      <p className="font-serif text-6xl leading-none font-semibold">{big}</p>
      <p className="text-muted-foreground mt-2">{small}</p>
    </div>
  );
}
