"use client";

import { useEffect, useState } from "react";
import { differenceInCalendarDays, parseISO } from "date-fns";

/** "124 days to go" – worked out in the visitor's browser, so it's never stale. */
export function SiteCountdown({ date, big = false }: { date: string | null; big?: boolean }) {
  const [days, setDays] = useState<number | null>(null);
  useEffect(() => {
    if (!date) return;
    const update = () => setDays(differenceInCalendarDays(parseISO(date), new Date()));
    update();
    const t = setInterval(update, 60 * 60 * 1000);
    return () => clearInterval(t);
  }, [date]);

  if (!date || days == null) return <span className="invisible">…</span>;
  if (days < 0) return <span>Happily married</span>;
  if (days === 0) return <span>Today&rsquo;s the day!</span>;
  return big ? (
    <span className="flex items-baseline gap-2">
      <span className="font-[family-name:var(--site-heading)] text-5xl tabular-nums @3xl:text-7xl">{days}</span>
      <span>{days === 1 ? "day to go" : "days to go"}</span>
    </span>
  ) : (
    <span>
      <span className="tabular-nums">{days}</span> {days === 1 ? "day" : "days"} to go
    </span>
  );
}
