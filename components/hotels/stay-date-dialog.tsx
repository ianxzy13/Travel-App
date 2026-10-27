"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { setStayDates } from "@/app/app/hotels/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addDays,
  effectiveStay,
  nightsBetween,
  normaliseStay,
  type Stay,
} from "@/lib/hotels/nights";
import { fmtDateRange } from "@/lib/i18n/format";

/** Quick changes to one side of the stay, or "edit" to type both dates by hand. */
export type StayMode = "edit" | "earlier" | "later" | "arriveLater" | "leaveEarlier";
export const QUICK_MODES = ["earlier", "later", "arriveLater", "leaveEarlier"] as const;

export type StayDialogGuest = {
  id: string;
  name: string;
  stayFrom: string | null;
  stayTo: string | null;
};

const SIDE = {
  earlier: "from",
  arriveLater: "from",
  later: "to",
  leaveEarlier: "to",
} as const;

/** Change when one or more guests arrive and leave. */
export function StayDateDialog({
  mode,
  guests,
  booked,
  onClose,
  onSaved,
}: {
  mode: StayMode;
  guests: StayDialogGuest[];
  booked: Stay | null;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const t = useTranslations("hotels.stays");
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  // Quick options need the booked dates to measure from.
  const m: StayMode = booked ? mode : "edit";

  const first = guests[0];
  const firstStay = first
    ? effectiveStay({ from: first.stayFrom, to: first.stayTo }, booked)
    : booked;
  const [from, setFrom] = useState(firstStay?.from ?? booked?.from ?? "");
  const [to, setTo] = useState(firstStay?.to ?? booked?.to ?? "");

  const limits =
    m === "edit" || !booked
      ? {}
      : {
          earlier: { max: addDays(booked.from, -1) },
          later: { min: addDays(booked.to, 1) },
          arriveLater: { min: addDays(booked.from, 1), max: addDays(booked.to, -1) },
          leaveEarlier: { min: addDays(booked.from, 1), max: addDays(booked.to, -1) },
        }[m];
  const min = "min" in limits ? limits.min : undefined;
  const max = "max" in limits ? limits.max : undefined;
  const side = m === "edit" ? null : SIDE[m];
  const fits = (d: string | null) => !!d && (!min || d >= min) && (!max || d <= max);
  const ownSide = first && side ? (side === "from" ? first.stayFrom : first.stayTo) : null;
  const [value, setValue] = useState(
    fits(ownSide) ? (ownSide as string) : m === "earlier" ? (max ?? "") : (min ?? ""),
  );

  let error: string | null = null;
  let note: string | null = null;
  let patch: { from?: string | null; to?: string | null } = {};
  if (side) {
    if (!fits(value)) error = t(`dialog.outside.${m as Exclude<StayMode, "edit">}`);
    else if (
      guests.some((g) => !effectiveStay({ from: g.stayFrom, to: g.stayTo, [side]: value }, booked))
    )
      error = t("dialog.broken");
    else {
      patch = { [side]: value };
      const extra =
        m === "earlier"
          ? nightsBetween(value, booked!.from)
          : m === "later"
            ? nightsBetween(booked!.to, value)
            : 0;
      if (extra) note = t("dialog.extra", { count: extra });
    }
  } else if (!from || !to) error = t("dialog.bothDates");
  else if (nightsBetween(from, to) === 0) error = t("dialog.broken");
  else {
    // Dates equal to the booking are stored as "same as booked".
    patch = normaliseStay({ from, to }, booked);
    note = t("dialog.nights", { count: nightsBetween(from, to) });
  }

  const save = () =>
    startTransition(async () => {
      const r = await setStayDates({ guestIds: guests.map((g) => g.id), ...patch });
      if (r.ok) {
        toast.success(t("saved"));
        onSaved?.();
        onClose();
      } else toast.error(r.error);
    });

  const names = guests.map((g) => g.name);
  const who =
    names.length <= 3
      ? names.join(", ")
      : t("dialog.andMore", { names: names.slice(0, 2).join(", "), count: names.length - 2 });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t(`mode.${m}`)}</DialogTitle>
          <DialogDescription>
            {who}
            {booked &&
              ` · ${t("dialog.booked", { range: fmtDateRange(booked.from, booked.to, locale) })}`}
          </DialogDescription>
        </DialogHeader>
        {side ? (
          <div className="space-y-1.5">
            <Label htmlFor="stay-date">
              {t(side === "from" ? "dialog.arrives" : "dialog.leaves")}
            </Label>
            <Input
              id="stay-date"
              type="date"
              value={value}
              min={min}
              max={max}
              aria-invalid={!!error || undefined}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="stay-from">{t("dialog.arrives")}</Label>
              <Input
                id="stay-from"
                type="date"
                value={from}
                aria-invalid={!!error || undefined}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stay-to">{t("dialog.leaves")}</Label>
              <Input
                id="stay-to"
                type="date"
                value={to}
                min={from ? addDays(from, 1) : undefined}
                aria-invalid={!!error || undefined}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>
        )}
        <p
          className={error ? "text-destructive text-sm" : "text-muted-foreground text-sm"}
          aria-live="polite"
        >
          {error ?? note}
        </p>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("dialog.cancel")}
          </Button>
          <Button disabled={!!error || pending} onClick={save}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {t("dialog.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
