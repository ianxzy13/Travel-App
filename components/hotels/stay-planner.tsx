"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ArrowLeft,
  BedDouble,
  CalendarClock,
  Check,
  Copy,
  Loader2,
  MessageCircle,
  MoreVertical,
  Printer,
  X,
} from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { savePeoplePerRoom, saveBookedDates, setStayDates } from "@/app/app/hotels/actions";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { ActionResult } from "@/lib/action-result";
import {
  addDays,
  effectiveStay,
  nightsBetween,
  stayDiff,
  staySummary,
  type Stay,
} from "@/lib/hotels/nights";
import {
  bookedStay,
  guestStays,
  guestsForHotel,
  mainHotelId,
  type GuestSaidDates,
  type StayFilters,
  type StayGuest,
  type StayHotel,
} from "@/lib/hotels/stays";
import { fmtDate, fmtDateRange } from "@/lib/i18n/format";
import { QUICK_MODES, StayDateDialog, type StayMode } from "./stay-date-dialog";
import { StaySummaryView, useSummaryText } from "./stay-summary";

type Mode = StayMode;

type Props = {
  hotels: StayHotel[];
  guests: StayGuest[];
  guestSaid: Record<string, GuestSaidDates>;
  weddingDate: string | null;
  canEdit: boolean;
};

export function StayPlanner({ hotels, guests, guestSaid, weddingDate, canEdit }: Props) {
  const t = useTranslations("hotels.stays");
  const summaryText = useSummaryText();
  const [hotelId, setHotelId] = useState(() => mainHotelId(hotels));
  const [filters, setFilters] = useState<StayFilters>({ notReplied: false, noRoom: false });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<{ mode: Mode; ids: string[] } | null>(null);
  const [pending, startTransition] = useTransition();

  const hotel = hotels.find((h) => h.id === hotelId) ?? null;
  const booked = useMemo(() => bookedStay(hotel), [hotel]);
  const perRoom = hotel?.people_per_room ?? 4;
  const list = useMemo(
    () => (hotel ? guestsForHotel(guests, hotel.id, filters) : []),
    [guests, hotel, filters],
  );
  const stays = useMemo(() => guestStays(list, booked), [list, booked]);
  const stayOf = new Map(stays.map((s) => [s.id, s.stay]));
  const summary = useMemo(() => staySummary(stays, booked, perRoom), [stays, booked, perRoom]);
  const byId = new Map(guests.map((g) => [g.id, g]));
  const openDialog = (mode: Mode, ids: string[]) => setDialog({ mode, ids });

  const households = useMemo(() => {
    const map = new Map<string, { id: string; name: string; members: StayGuest[] }>();
    for (const g of list) {
      const h = map.get(g.householdId) ?? { id: g.householdId, name: g.householdName, members: [] };
      h.members.push(g);
      map.set(g.householdId, h);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [list]);

  const visibleSelected = list.filter((g) => selected.has(g.id)).map((g) => g.id);

  function run(fn: () => Promise<ActionResult>, success: string, after?: () => void) {
    startTransition(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(success);
        after?.();
      } else toast.error(r.error);
    });
  }

  const toggle = (ids: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  const reset = (ids: string[]) =>
    run(() => setStayDates({ guestIds: ids, from: null, to: null }), t("saved"));

  const copySummary = async () => {
    if (!hotel || !booked) return;
    try {
      await navigator.clipboard.writeText(summaryText(hotel.name, summary, booked, perRoom));
      toast.success(t("summary.copied"));
    } catch {
      toast.error(t("summary.copyFailed"));
    }
  };

  const printHref = hotel
    ? `/print/stays?hotel=${hotel.id}${filters.notReplied ? "&notReplied=1" : ""}${
        filters.noRoom ? "&noRoom=1" : ""
      }`
    : "/print/stays";

  const header = (
    <PageHeader
      title={t("title")}
      description={t("description")}
      actions={
        <Button asChild variant="outline" size="sm">
          <Link href="/app/hotels">
            <ArrowLeft aria-hidden /> {t("back")}
          </Link>
        </Button>
      }
    />
  );

  if (!hotel) {
    return (
      <>
        {header}
        <div className="bg-card flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-16 text-center">
          <span className="bg-primary-soft text-primary-ink inline-flex size-14 items-center justify-center rounded-full">
            <BedDouble className="size-7" aria-hidden />
          </span>
          <h2 className="text-3xl">{t("noHotel.title")}</h2>
          <p className="text-muted-foreground max-w-sm">{t("noHotel.text")}</p>
          <Button asChild>
            <Link href="/app/hotels">{t("noHotel.button")}</Link>
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      {header}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-6">
          {/* Booked dates */}
          <section className="bg-card space-y-4 rounded-xl border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl">{t("booking.title")}</h2>
              {hotels.length > 1 && (
                <Select
                  value={hotel.id}
                  onValueChange={(v) => {
                    setHotelId(v);
                    setSelected(new Set());
                  }}
                >
                  <SelectTrigger className="w-auto min-w-40" aria-label={t("booking.hotel")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {hotels.map((h) => (
                      <SelectItem key={h.id} value={h.id}>
                        {h.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <BookedDates key={hotel.id} hotel={hotel} canEdit={canEdit} />
            {hotels.length > 1 && (
              <p className="text-muted-foreground text-xs">{t("booking.perHotel")}</p>
            )}
          </section>

          {/* Guests */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl">
                {t("guests.title")}{" "}
                <span className="text-muted-foreground text-base">({list.length})</span>
              </h2>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <Switch
                    checked={filters.notReplied}
                    onCheckedChange={(v) => setFilters((f) => ({ ...f, notReplied: v }))}
                  />
                  {t("guests.showNotReplied")}
                </label>
                <label className="flex items-center gap-2">
                  <Switch
                    checked={filters.noRoom}
                    onCheckedChange={(v) => setFilters((f) => ({ ...f, noRoom: v }))}
                  />
                  {t("guests.showNoRoom")}
                </label>
              </div>
            </div>

            {!booked && (
              <p className="bg-warning/10 rounded-lg p-3 text-sm">{t("guests.setBookingFirst")}</p>
            )}

            {households.length === 0 ? (
              <p className="text-muted-foreground bg-card rounded-xl border border-dashed p-6 text-center text-sm">
                {t("guests.empty")}
              </p>
            ) : (
              <ul className="bg-card divide-y rounded-xl border">
                {households.map((h) => (
                  <Household
                    key={h.id}
                    name={h.name}
                    members={h.members}
                    said={guestSaid[h.id] ?? null}
                    booked={booked}
                    stayOf={stayOf}
                    selected={selected}
                    canEdit={canEdit}
                    pending={pending}
                    onToggle={toggle}
                    onMode={openDialog}
                    onReset={reset}
                    onSet={(ids, from, to, msg) =>
                      run(() => setStayDates({ guestIds: ids, from, to }), msg)
                    }
                  />
                ))}
              </ul>
            )}

            {canEdit && visibleSelected.length > 0 && (
              <div className="bg-card sticky bottom-4 z-10 flex flex-wrap items-center gap-2 rounded-xl border p-3 shadow-lg">
                <span className="me-auto text-sm font-medium">
                  {t("bulk.selected", { count: visibleSelected.length })}
                </span>
                {(booked ? (["edit", ...QUICK_MODES] as const) : (["edit"] as const)).map((m) => (
                  <Button
                    key={m}
                    size="sm"
                    variant="outline"
                    onClick={() => setDialog({ mode: m, ids: visibleSelected })}
                  >
                    {t(`mode.${m}`)}
                  </Button>
                ))}
                <Button size="sm" variant="ghost" onClick={() => reset(visibleSelected)}>
                  {t("reset")}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  aria-label={t("bulk.clear")}
                  onClick={() => setSelected(new Set())}
                >
                  <X aria-hidden />
                </Button>
              </div>
            )}
          </section>
        </div>

        {/* Summary for the hotel */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <section className="bg-card space-y-4 rounded-xl border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl">{t("summary.title")}</h2>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={copySummary} disabled={!booked}>
                  <Copy aria-hidden /> {t("summary.copy")}
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href={printHref}>
                    <Printer aria-hidden /> {t("summary.print")}
                  </Link>
                </Button>
              </div>
            </div>
            <PeoplePerRoom key={hotel.id} hotel={hotel} canEdit={canEdit} />
            {booked ? (
              <StaySummaryView
                summary={summary}
                booked={booked}
                perRoom={perRoom}
                weddingDate={weddingDate}
              />
            ) : (
              <p className="text-muted-foreground text-sm">{t("summary.needBooking")}</p>
            )}
          </section>
        </aside>
      </div>

      {dialog && (
        <StayDateDialog
          mode={dialog.mode}
          guests={dialog.ids.flatMap((id) => byId.get(id) ?? [])}
          booked={booked}
          onClose={() => setDialog(null)}
          onSaved={() => dialog.ids.length > 1 && setSelected(new Set())}
        />
      )}
      {pending && (
        <span className="sr-only" role="status">
          {t("saving")}
        </span>
      )}
    </>
  );
}

function BookedDates({ hotel, canEdit }: { hotel: StayHotel; canEdit: boolean }) {
  const t = useTranslations("hotels.stays");
  const [from, setFrom] = useState(hotel.booked_from ?? "");
  const [to, setTo] = useState(hotel.booked_to ?? "");
  const [pending, startTransition] = useTransition();
  const nights = nightsBetween(from, to);
  const invalid = !!from && !!to && nights === 0;
  const dirty = from !== (hotel.booked_from ?? "") || to !== (hotel.booked_to ?? "");

  const save = () =>
    startTransition(async () => {
      const r = await saveBookedDates(hotel.id, { from: from || null, to: to || null });
      if (r.ok) toast.success(t("saved"));
      else toast.error(r.error);
    });

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="booked-from">{t("booking.checkIn")}</Label>
        <Input
          id="booked-from"
          type="date"
          value={from}
          disabled={!canEdit}
          onChange={(e) => setFrom(e.target.value)}
          className="w-44"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="booked-to">{t("booking.checkOut")}</Label>
        <Input
          id="booked-to"
          type="date"
          value={to}
          min={from ? addDays(from, 1) : undefined}
          disabled={!canEdit}
          aria-invalid={invalid || undefined}
          onChange={(e) => setTo(e.target.value)}
          className="w-44"
        />
      </div>
      {canEdit && (
        <Button onClick={save} disabled={!dirty || invalid || pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
          {t("booking.save")}
        </Button>
      )}
      <p className="text-muted-foreground w-full text-sm" aria-live="polite">
        {invalid
          ? t("booking.invalid")
          : nights > 0
            ? t("booking.nights", { count: nights })
            : null}
      </p>
    </div>
  );
}

function Household({
  name,
  members,
  said,
  booked,
  stayOf,
  selected,
  canEdit,
  pending,
  onToggle,
  onMode,
  onReset,
  onSet,
}: {
  name: string;
  members: StayGuest[];
  said: GuestSaidDates | null;
  booked: Stay | null;
  stayOf: Map<string, Stay | null>;
  selected: Set<string>;
  canEdit: boolean;
  pending: boolean;
  onToggle: (ids: string[], on: boolean) => void;
  onMode: (mode: Mode, ids: string[]) => void;
  onReset: (ids: string[]) => void;
  onSet: (ids: string[], from: string | null, to: string | null, msg: string) => void;
}) {
  const t = useTranslations("hotels.stays");
  const locale = useLocale();
  const ids = members.map((m) => m.id);
  const count = ids.filter((id) => selected.has(id)).length;

  // What the guests told us on their RSVP, if it differs from what's set.
  let hint: { from: string | null; to: string | null } | null = null;
  if (said && booked) {
    const from = said.arrival && said.arrival !== booked.from ? said.arrival : null;
    const to = said.departure && said.departure !== booked.to ? said.departure : null;
    const target = effectiveStay({ from, to }, booked);
    if (target && members.some((m) => !sameStay(stayOf.get(m.id) ?? null, target)))
      hint = { from, to };
  }

  return (
    <li className="p-3">
      <div className="flex flex-wrap items-center gap-2">
        {canEdit && members.length > 1 && (
          <Checkbox
            checked={count === 0 ? false : count === ids.length ? true : "indeterminate"}
            onCheckedChange={(v) => onToggle(ids, v === true)}
            aria-label={t("selectHousehold", { name })}
          />
        )}
        <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {name}
        </h3>
      </div>
      {said && (said.arrival || said.departure) && (
        <div className="bg-muted/50 mt-2 flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-xs">
          <MessageCircle className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
          <span>
            {t("guestSaid", {
              arrival: said.arrival ? fmtDate(said.arrival, locale, "medium") : "—",
              departure: said.departure ? fmtDate(said.departure, locale, "medium") : "—",
            })}
          </span>
          {canEdit && hint && (
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              disabled={pending}
              onClick={() => onSet(ids, hint.from, hint.to, t("saved"))}
            >
              {t("useThis")}
            </Button>
          )}
        </div>
      )}
      <ul className="mt-1">
        {members.map((g) => (
          <GuestRow
            key={g.id}
            guest={g}
            stay={stayOf.get(g.id) ?? null}
            booked={booked}
            household={ids}
            checked={selected.has(g.id)}
            canEdit={canEdit}
            pending={pending}
            onToggle={onToggle}
            onMode={onMode}
            onReset={onReset}
            onSet={onSet}
          />
        ))}
      </ul>
    </li>
  );
}

function sameStay(a: Stay | null, b: Stay | null) {
  return a?.from === b?.from && a?.to === b?.to;
}

function GuestRow({
  guest: g,
  stay,
  booked,
  household,
  checked,
  canEdit,
  pending,
  onToggle,
  onMode,
  onReset,
  onSet,
}: {
  guest: StayGuest;
  stay: Stay | null;
  booked: Stay | null;
  household: string[];
  checked: boolean;
  canEdit: boolean;
  pending: boolean;
  onToggle: (ids: string[], on: boolean) => void;
  onMode: (mode: Mode, ids: string[]) => void;
  onReset: (ids: string[]) => void;
  onSet: (ids: string[], from: string | null, to: string | null, msg: string) => void;
}) {
  const t = useTranslations("hotels.stays");
  const locale = useLocale();
  const custom = g.stayFrom !== null || g.stayTo !== null;
  const diff = stay && booked ? stayDiff(stay, booked) : null;

  let label: React.ReactNode;
  if (!stay) label = t("noDates");
  else if (!diff || diff.same)
    label = t("bookedDates", { range: fmtDateRange(stay.from, stay.to, locale) });
  else {
    const parts = [
      diff.early && t("diff.early", { count: diff.early }),
      diff.late && t("diff.late", { count: diff.late }),
      diff.skipStart + diff.skipEnd > 0 &&
        t("diff.shorter", { count: diff.skipStart + diff.skipEnd }),
    ].filter(Boolean);
    label = (
      <>
        <span className="text-foreground font-medium">
          {fmtDateRange(stay.from, stay.to, locale)}
        </span>{" "}
        · {parts.join(" · ")}
      </>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2">
      {canEdit && (
        <Checkbox
          checked={checked}
          onCheckedChange={(v) => onToggle([g.id], v === true)}
          aria-label={t("select", { name: g.name })}
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-1.5 text-sm">
          <span className="truncate">{g.name}</span>
          {g.rsvp === "not_replied" && (
            <span className="bg-muted text-muted-foreground rounded-full px-1.5 text-[10px]">
              {t("badge.notReplied")}
            </span>
          )}
          {(g.wantsRoom === "no" || g.wantsRoom === "elsewhere") && (
            <span className="bg-muted text-muted-foreground rounded-full px-1.5 text-[10px]">
              {t("badge.noRoom")}
            </span>
          )}
        </p>
        {canEdit ? (
          <button
            type="button"
            onClick={() => onMode("edit", [g.id])}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 rounded text-start text-xs underline-offset-2 hover:underline"
            aria-label={t("editFor", { name: g.name })}
          >
            {custom && <CalendarClock className="text-primary-ink size-3 shrink-0" aria-hidden />}
            <span>{label}</span>
          </button>
        ) : (
          <p className="text-muted-foreground flex items-center gap-1 text-xs">
            {custom && <CalendarClock className="text-primary-ink size-3 shrink-0" aria-hidden />}
            <span>{label}</span>
          </p>
        )}
      </div>
      {canEdit && (
        <div className="flex items-center gap-1">
          {booked ? (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => onMode("earlier", [g.id])}
              >
                {t("mode.earlier")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => onMode("later", [g.id])}
              >
                {t("mode.later")}
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => onMode("edit", [g.id])}
            >
              {t("mode.edit")}
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="size-8"
                aria-label={t("more", { name: g.name })}
              >
                <MoreVertical aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onMode("edit", [g.id])}>
                {t("mode.edit")}
              </DropdownMenuItem>
              {booked && (
                <>
                  <DropdownMenuItem onSelect={() => onMode("arriveLater", [g.id])}>
                    {t("mode.arriveLater")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onMode("leaveEarlier", [g.id])}>
                    {t("mode.leaveEarlier")}
                  </DropdownMenuItem>
                </>
              )}
              {household.length > 1 && (
                <DropdownMenuItem
                  disabled={pending}
                  onSelect={() => onSet(household, g.stayFrom, g.stayTo, t("householdDone"))}
                >
                  {t("sameForHousehold")}
                </DropdownMenuItem>
              )}
              {custom && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled={pending} onSelect={() => onReset([g.id])}>
                    {t("reset")}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </li>
  );
}

/** The couple's own room size: any whole number, remembered per hotel. */
function PeoplePerRoom({ hotel, canEdit }: { hotel: StayHotel; canEdit: boolean }) {
  const t = useTranslations("hotels.stays");
  const [value, setValue] = useState(String(hotel.people_per_room ?? 4));
  const [pending, startTransition] = useTransition();
  const n = Number(value);
  const valid = Number.isInteger(n) && n >= 1 && n <= 1000;

  const save = () => {
    if (!valid || n === (hotel.people_per_room ?? 4)) return;
    startTransition(async () => {
      const r = await savePeoplePerRoom(hotel.id, n);
      if (!r.ok) toast.error(r.error);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <Label htmlFor="per-room">{t("summary.perRoom")}</Label>
      <Input
        id="per-room"
        type="number"
        inputMode="numeric"
        min={1}
        step={1}
        value={value}
        disabled={!canEdit}
        aria-invalid={!valid || undefined}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === "Enter" && save()}
        className="w-20"
      />
      {pending && <Loader2 className="text-muted-foreground size-4 animate-spin" aria-hidden />}
      {!valid && <span className="text-destructive text-xs">{t("summary.perRoomInvalid")}</span>}
    </div>
  );
}
