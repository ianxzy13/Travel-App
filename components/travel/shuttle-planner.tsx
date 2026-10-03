"use client";

import { useMemo, useState } from "react";
import { Car, Printer, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { planShuttleRuns, type ShuttleArrival, type ShuttleDay } from "@/lib/places/shuttle";

type Props = {
  /** arrivals the couple put on a shuttle */
  arrivals: ShuttleArrival[];
  /** shown when there are none yet */
  emptyText: string;
};

export function ShuttlePlanner({ arrivals, emptyText }: Props) {
  const t = useTranslations("travel.shuttle");
  const locale = useLocale();
  const [windowMinutes, setWindowMinutes] = useState(90);

  const days = useMemo(
    () => planShuttleRuns(arrivals, { windowMinutes, locale }),
    [arrivals, windowMinutes, locale],
  );

  const totalRuns = days.reduce((n, d) => n + d.runs.length, 0);
  const totalPeople = days.reduce((n, d) => n + d.totalPeople, 0);

  if (arrivals.length === 0) {
    return (
      <div className="text-muted-foreground rounded-xl border-2 border-dashed p-8 text-center text-sm">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-36">
          <Label htmlFor="window">{t("window")}</Label>
          <div className="flex items-center gap-2">
            <Input
              id="window"
              type="number"
              min={30}
              max={360}
              step={15}
              value={windowMinutes}
              onChange={(e) => setWindowMinutes(Number(e.target.value) || 90)}
              className="w-20"
            />
            <span className="text-muted-foreground text-sm">{t("minutes")}</span>
          </div>
        </div>
        <div className="text-muted-foreground text-sm">
          {t("summary", { runs: totalRuns, people: totalPeople })}
        </div>
        <Link href="/print/shuttle" target="_blank" className="ml-auto">
          <Button variant="outline" size="sm">
            <Printer className="mr-1 size-4" aria-hidden /> {t("print")}
          </Button>
        </Link>
      </div>

      {days.map((day) => (
        <ShuttleDayCard key={day.date} day={day} />
      ))}
    </div>
  );
}

function ShuttleDayCard({ day }: { day: ShuttleDay }) {
  const t = useTranslations("travel.shuttle");
  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 font-medium">
        <Car className="size-4" aria-hidden />
        {day.label}
        <span className="text-muted-foreground text-sm font-normal">
          · {t("dayPeople", { count: day.totalPeople })}
        </span>
      </h3>
      {day.runs.map((run) => (
        <div key={run.id} className="bg-card rounded-xl border p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="bg-primary/10 text-primary-ink rounded px-2 py-0.5 text-sm font-medium">
              {run.airport}
            </span>
            <span className="text-sm">
              {run.windowStart}–{run.windowEnd}
            </span>
            <span className="text-muted-foreground flex items-center gap-1 text-sm">
              <Users className="size-3.5" aria-hidden />
              {run.peopleCount}
            </span>
          </div>
          <ul className="mt-2 space-y-1">
            {run.passengers.map((p, i) => (
              <li key={i} className="text-sm">
                <span className="font-medium">{p.name}</span>
                {p.arrivalTime && (
                  <span className="text-muted-foreground"> · {p.arrivalTime}</span>
                )}
                {p.flightNumber && (
                  <span className="text-muted-foreground"> · {p.flightNumber}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
