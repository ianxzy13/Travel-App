"use client";

import { Heart } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { fmtDate, fmtDateRange } from "@/lib/i18n/format";
import { nightsBetween, type Stay, type staySummary } from "@/lib/hotels/nights";
import { cn } from "@/lib/utils";

export type Summary = ReturnType<typeof staySummary>;

type Line = { key: string; date: string; nights: number; names: string[] };

/** "3 Mar: Ana, Marko" — people arriving (or leaving) the same day, together. */
function byDay(list: { date: string; nights: number; name: string }[]): Line[] {
  const out = new Map<string, Line>();
  for (const x of list) {
    const key = `${x.date}|${x.nights}`;
    const line = out.get(key) ?? { key, date: x.date, nights: x.nights, names: [] };
    line.names.push(x.name);
    out.set(key, line);
  }
  return [...out.values()];
}

/** The plain-text version for the hotel (Copy button). */
export function useSummaryText() {
  const t = useTranslations("hotels.stays");
  const locale = useLocale();
  return (hotelName: string, s: Summary, booked: Stay, perRoom: number) => {
    const d = (x: string) => fmtDate(x, locale, "medium");
    const lines = [
      hotelName,
      t("summary.mainLine", {
        range: fmtDateRange(booked.from, booked.to, locale),
        nights: nightsBetween(booked.from, booked.to),
        guests: s.guests,
        rooms: s.rooms,
        perRoom,
      }),
    ];
    const section = (title: string, items: string[]) => {
      if (items.length) lines.push("", title, ...items.map((i) => `- ${i}`));
    };
    section(
      t("summary.early"),
      byDay(s.early).map((l) =>
        t("summary.arriveLine", { names: l.names.join(", "), date: d(l.date), nights: l.nights }),
      ),
    );
    section(
      t("summary.late"),
      byDay(s.late).map((l) =>
        t("summary.leaveLine", { names: l.names.join(", "), date: d(l.date), nights: l.nights }),
      ),
    );
    section(
      t("summary.shorter"),
      s.shorter.map((x) =>
        t("summary.shorterLine", {
          names: x.name,
          range: fmtDateRange(x.stay.from, x.stay.to, locale),
          nights: x.nights,
        }),
      ),
    );
    section(
      t("summary.perNight"),
      s.nights.map((n) =>
        t("summary.nightLine", {
          date: fmtDate(n.date, locale, "full"),
          guests: n.guests,
          rooms: n.rooms,
        }),
      ),
    );
    lines.push("", t("summary.extraTotal", { count: s.extraRoomNights }));
    return lines.join("\n");
  };
}

export function StaySummaryView({
  summary: s,
  booked,
  perRoom,
  weddingDate,
}: {
  summary: Summary;
  booked: Stay;
  perRoom: number;
  weddingDate: string | null;
}) {
  const t = useTranslations("hotels.stays");
  const locale = useLocale();
  const d = (x: string) => fmtDate(x, locale, "medium");

  return (
    <div className="space-y-5 text-sm">
      <div>
        <p className="text-muted-foreground text-xs tracking-wide uppercase">{t("summary.main")}</p>
        <p className="mt-1 text-base">
          {t("summary.mainLine", {
            range: fmtDateRange(booked.from, booked.to, locale),
            nights: nightsBetween(booked.from, booked.to),
            guests: s.guests,
            rooms: s.rooms,
            perRoom,
          })}
        </p>
      </div>

      <Section title={t("summary.early")} empty={!s.early.length}>
        {byDay(s.early).map((l) => (
          <li key={l.key}>
            {t("summary.arriveLine", {
              names: l.names.join(", "),
              date: d(l.date),
              nights: l.nights,
            })}
          </li>
        ))}
      </Section>
      <Section title={t("summary.late")} empty={!s.late.length}>
        {byDay(s.late).map((l) => (
          <li key={l.key}>
            {t("summary.leaveLine", {
              names: l.names.join(", "),
              date: d(l.date),
              nights: l.nights,
            })}
          </li>
        ))}
      </Section>
      {s.shorter.length > 0 && (
        <Section title={t("summary.shorter")}>
          {s.shorter.map((x) => (
            <li key={x.id}>
              {t("summary.shorterLine", {
                names: x.name,
                range: fmtDateRange(x.stay.from, x.stay.to, locale),
                nights: x.nights,
              })}
            </li>
          ))}
        </Section>
      )}

      <div>
        <p className="text-muted-foreground mb-2 text-xs tracking-wide uppercase">
          {t("summary.perNight")}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-start text-xs">
                <th className="py-1.5 pe-2 text-start font-normal">{t("table.night")}</th>
                <th className="px-2 py-1.5 text-end font-normal">{t("table.guests")}</th>
                <th className="py-1.5 ps-2 text-end font-normal">{t("table.rooms")}</th>
              </tr>
            </thead>
            <tbody>
              {s.nights.map((n) => {
                const wedding = n.date === weddingDate;
                return (
                  <tr
                    key={n.date}
                    className={cn(
                      "border-b last:border-0",
                      wedding && "bg-primary-soft font-medium",
                      !n.booked && !wedding && "text-muted-foreground",
                    )}
                  >
                    <td className="py-1.5 pe-2">
                      {fmtDate(n.date, locale, "full")}
                      {wedding && (
                        <span className="text-primary-ink ms-2 inline-flex items-center gap-1 text-xs">
                          <Heart className="size-3" aria-hidden /> {t("table.weddingNight")}
                        </span>
                      )}
                      {!n.booked && <span className="ms-2 text-xs italic">{t("table.extra")}</span>}
                    </td>
                    <td className="px-2 py-1.5 text-end tabular-nums">{n.guests}</td>
                    <td className="py-1.5 ps-2 text-end tabular-nums">{n.rooms}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="font-medium">{t("summary.extraTotal", { count: s.extraRoomNights })}</p>
    </div>
  );
}

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty?: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations("hotels.stays");
  return (
    <div>
      <p className="text-muted-foreground mb-1 text-xs tracking-wide uppercase">{title}</p>
      {empty ? (
        <p className="text-muted-foreground">{t("summary.nobody")}</p>
      ) : (
        <ul className="list-disc space-y-0.5 ps-5">{children}</ul>
      )}
    </div>
  );
}
