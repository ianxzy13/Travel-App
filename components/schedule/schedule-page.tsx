"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  CalendarPlus,
  Clock,
  Download,
  Loader2,
  MapPin,
  MoreHorizontal,
  Phone,
  Plus,
  Printer,
  Sparkles,
  User,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { addTemplateDay, importEvents, shiftSchedule } from "@/app/app/schedule/actions";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ScheduleItemRow } from "@/lib/database.types";
import { fmtDate, fmtTime } from "@/lib/i18n/format";
import { endTime, overlaps, sortByTime } from "@/lib/schedule/time";
import { cn } from "@/lib/utils";
import { ItemSheet } from "./item-sheet";

type Props = {
  items: ScheduleItemRow[];
  events: { id: string; name: string; event_date: string | null; start_time: string | null }[];
  vendors: { id: string; name: string; contact_name: string | null; phone: string | null }[];
  weddingDate: string | null;
  canEdit: boolean;
};

/** "" stands for the wedding day (items saved with no date follow the wedding date). */
const WEDDING = "";

export function SchedulePage({ items, events, vendors, weddingDate, canEdit }: Props) {
  const t = useTranslations("schedule");
  const locale = useLocale();
  const time = (hhmm: string | null) => fmtTime(hhmm, locale);
  // Days to show: the wedding day, days that already have items, and other event days.
  const days = useMemo(() => {
    const set = new Set<string>([WEDDING]);
    for (const i of items) if (i.day && i.day !== weddingDate) set.add(i.day);
    for (const e of events) if (e.event_date && e.event_date !== weddingDate) set.add(e.event_date);
    return [...set].sort((a, b) =>
      (a === WEDDING ? (weddingDate ?? "") : a).localeCompare(
        b === WEDDING ? (weddingDate ?? "") : b,
      ),
    );
  }, [items, events, weddingDate]);

  const [day, setDay] = useState(WEDDING);
  const [extraDay, setExtraDay] = useState("");
  const [sheet, setSheet] = useState<string | "new" | null>(null);
  const [busy, startBusy] = useTransition();

  const allDays = extraDay && !days.includes(extraDay) ? [...days, extraDay].sort() : days;
  const dateOf = (d: string) => (d === WEDDING ? weddingDate : d);
  const dayItemsRaw = () =>
    items.filter((i) => (day === WEDDING ? !i.day || i.day === weddingDate : i.day === day));
  const dayItems = sortByTime(dayItemsRaw());
  const clash = overlaps(dayItems);
  const vendorById = new Map(vendors.map((v) => [v.id, v]));
  // the ceremony: named so in English or the couple's language, else the first timed event
  const ceremony =
    events.find(
      (e) => (/ceremon/i.test(e.name) || e.name === t("template.ceremony")) && e.start_time,
    ) ?? events.find((e) => e.start_time);
  const [ceremonyTime, setCeremonyTime] = useState(ceremony?.start_time?.slice(0, 5) ?? "15:00");
  // events of this day that aren't on the schedule yet (linked, or an item with the same name)
  const dayEvents = events.filter(
    (e) =>
      e.event_date === dateOf(day) &&
      e.start_time &&
      !dayItemsRaw().some(
        (i) => i.event_id === e.id || i.title.trim().toLowerCase() === e.name.trim().toLowerCase(),
      ),
  );
  const current = sheet && sheet !== "new" ? (items.find((i) => i.id === sheet) ?? null) : null;
  const serverDay = day === WEDDING ? null : day;

  function label(d: string) {
    const date = dateOf(d);
    if (d === WEDDING)
      return date ? t("weddingDayOn", { date: fmtDate(date, locale, "medium") }) : t("weddingDay");
    return fmtDate(d, locale, "medium");
  }

  function run(p: Promise<{ ok: boolean; error?: string }>, success?: string) {
    startBusy(async () => {
      const r = await p;
      if (!r.ok) toast.error(r.error);
      else if (success) toast.success(success);
    });
  }

  const lastEnd = dayItems.length
    ? endTime(dayItems.at(-1)!.start_time, dayItems.at(-1)!.duration_min ?? 30)
    : null;

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href={`/print/schedule${serverDay ? `?day=${serverDay}` : ""}`} target="_blank">
                <Printer aria-hidden /> {t("print")}
              </Link>
            </Button>
            {canEdit && (
              <Button size="sm" onClick={() => setSheet("new")}>
                <Plus aria-hidden /> {t("add")}
              </Button>
            )}
          </>
        }
      />

      <div className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2" role="tablist" aria-label={t("day")}>
            {allDays.map((d) => (
              <button
                key={d || "wedding"}
                type="button"
                role="tab"
                aria-selected={day === d}
                onClick={() => setDay(d)}
                className={cn(
                  "focus-visible:ring-ring h-9 shrink-0 rounded-full border px-4 text-sm whitespace-nowrap focus-visible:ring-2 focus-visible:outline-none",
                  day === d
                    ? "bg-primary text-primary-foreground border-primary"
                    : "hover:bg-accent",
                )}
              >
                {label(d)}
              </button>
            ))}
          </div>
          {canEdit && (
            <label className="text-muted-foreground hover:bg-accent flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-dashed px-3 text-sm">
              <CalendarPlus className="size-4" aria-hidden />
              <span>{t("anotherDay")}</span>
              <input
                type="date"
                className="w-0 opacity-0"
                aria-label={t("planAnother")}
                onChange={(e) => {
                  if (!e.target.value) return;
                  const d = e.target.value === weddingDate ? WEDDING : e.target.value;
                  setExtraDay(d);
                  setDay(d);
                }}
              />
            </label>
          )}
        </div>
      </div>

      {canEdit && dayEvents.length > 0 && (
        <div className="bg-primary-soft mb-4 flex flex-wrap items-center gap-3 rounded-xl px-4 py-3 text-sm">
          <span className="flex-1">
            {t("eventsToAdd", { count: dayEvents.length, name: dayEvents[0].name })}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => run(importEvents(serverDay), t("eventsAdded"))}
          >
            <Download aria-hidden /> {t("addEvents")}
          </Button>
        </div>
      )}

      {dayItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-8 text-center sm:p-12">
          <Clock className="text-primary-ink mx-auto size-10" aria-hidden />
          <h2 className="mt-4 text-2xl">{t("emptyTitle")}</h2>
          <p className="text-muted-foreground mx-auto mt-2 max-w-md">{t("emptyText")}</p>
          {canEdit && (
            <form
              className="mt-6 flex flex-wrap items-end justify-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                run(addTemplateDay(serverDay, ceremonyTime), t("sketched"));
              }}
            >
              <div className="space-y-1 text-start">
                <Label htmlFor="ceremony-time">{t("ceremonyAt")}</Label>
                <Input
                  id="ceremony-time"
                  type="time"
                  value={ceremonyTime}
                  onChange={(e) => setCeremonyTime(e.target.value)}
                  className="w-32"
                  required
                />
              </div>
              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}{" "}
                {t("useTemplate")}
              </Button>
              <Button type="button" variant="outline" onClick={() => setSheet("new")}>
                <Plus aria-hidden /> {t("fromScratch")}
              </Button>
            </form>
          )}
        </div>
      ) : (
        <>
          <ol className="before:bg-border relative space-y-3 before:absolute before:start-[4.25rem] before:top-2 before:bottom-2 before:w-px sm:before:start-[5.25rem]">
            {dayItems.map((item) => {
              const end = endTime(item.start_time, item.duration_min);
              const vendor = item.vendor_id ? vendorById.get(item.vendor_id) : undefined;
              const overlapWith = clash.get(item.id);
              return (
                <li key={item.id} className="relative flex gap-3 sm:gap-5">
                  <div className="w-14 shrink-0 pt-3 text-end sm:w-16">
                    <p className="font-medium tabular-nums">{time(item.start_time)}</p>
                    {end && (
                      <p className="text-muted-foreground text-xs tabular-nums">{time(end)}</p>
                    )}
                  </div>
                  <span
                    className="bg-primary ring-background relative z-10 mt-4 size-2.5 shrink-0 rounded-full ring-4"
                    aria-hidden
                  />
                  <div className="bg-card min-w-0 flex-1 rounded-xl border p-3">
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() => setSheet(item.id)}
                        className="focus-visible:ring-ring min-w-0 flex-1 rounded text-start font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
                      >
                        {item.title}
                        {item.duration_min ? (
                          <span className="text-muted-foreground ms-2 text-xs font-normal">
                            {t("minutes", { count: item.duration_min })}
                          </span>
                        ) : null}
                      </button>
                      {canEdit && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={t("moreFor", { title: item.title })}
                            >
                              <MoreHorizontal aria-hidden />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => setSheet(item.id)}>
                              {t("edit")}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {[15, -15, 30, -30].map((d) => (
                              <DropdownMenuItem
                                key={d}
                                disabled={busy}
                                onSelect={() =>
                                  run(
                                    shiftSchedule(item.id, serverDay, d),
                                    d > 0
                                      ? t("movedLater", { count: d })
                                      : t("movedEarlier", { count: -d }),
                                  )
                                }
                              >
                                {d > 0 ? t("later", { count: d }) : t("earlier", { count: -d })}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                    <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      {item.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3.5" aria-hidden /> {item.location}
                        </span>
                      )}
                      {item.owner && (
                        <span className="inline-flex items-center gap-1">
                          <User className="size-3.5" aria-hidden /> {item.owner}
                        </span>
                      )}
                      {vendor && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="size-3.5" aria-hidden />
                          {vendor.name}
                          {vendor.phone && (
                            <a
                              href={`tel:${vendor.phone.replace(/[^\d+]/g, "")}`}
                              className="text-primary-ink underline-offset-2 hover:underline"
                            >
                              {vendor.phone}
                            </a>
                          )}
                        </span>
                      )}
                    </div>
                    {item.notes && <p className="mt-1 text-sm whitespace-pre-wrap">{item.notes}</p>}
                    {overlapWith && (
                      <p className="text-muted-foreground mt-1 text-xs">
                        {t("overlaps", {
                          title: dayItems.find((i) => i.id === overlapWith)?.title ?? "",
                        })}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
          {lastEnd && (
            <p className="text-muted-foreground mt-4 text-sm">
              {t("dayEnds", { time: time(lastEnd) })}
            </p>
          )}
        </>
      )}

      <ItemSheet
        open={!!sheet && (sheet === "new" || !!current)}
        item={current}
        day={current ? (current.day ?? weddingDate ?? "") : (dateOf(day) ?? "")}
        defaultStart={lastEnd ?? ceremonyTime}
        vendors={vendors}
        canEdit={canEdit}
        onOpenChange={(o) => !o && setSheet(null)}
      />
    </>
  );
}
