"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Car, Check, Loader2, Plane, PlaneLanding, PlaneTakeoff } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { submitGuestFlights } from "@/app/w/[slug]/flights/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { fmtDate } from "@/lib/i18n/format";
import type { GuestFlightsPayload } from "@/lib/validation/rsvp";

/** What get_guest_flights() returns for one household. */
export type GuestFlights = {
  household: { name: string; code: string };
  travel: {
    arrival_from: string | null;
    arrival_airport: string | null;
    arrival_date: string | null;
    arrival_time: string | null;
    arrival_flight: string | null;
    departure_airport: string | null;
    departure_to: string | null;
    departure_date: string | null;
    departure_time: string | null;
    departure_flight: string | null;
    needs_transfer: boolean;
    transport_notes: string | null;
  } | null;
};

const toForm = (t: GuestFlights["travel"], airport: string | null): GuestFlightsPayload => ({
  arrival_from: t?.arrival_from ?? "",
  arrival_airport: t?.arrival_airport ?? airport ?? "",
  arrival_date: t?.arrival_date ?? "",
  arrival_time: t?.arrival_time?.slice(0, 5) ?? "",
  arrival_flight: t?.arrival_flight ?? "",
  departure_airport: t?.departure_airport ?? airport ?? "",
  departure_to: t?.departure_to ?? "",
  departure_date: t?.departure_date ?? "",
  departure_time: t?.departure_time?.slice(0, 5) ?? "",
  departure_flight: t?.departure_flight ?? "",
  needs_transfer: t?.needs_transfer ?? false,
  transport_notes: t?.transport_notes ?? "",
});

const shared = (t: GuestFlights["travel"]) =>
  !!t && !!(t.arrival_date || t.arrival_flight || t.departure_date || t.departure_flight);

/** The website's flight form for one household (/w/[slug]/flights?code=…). */
export function GuestFlightForm({
  slug,
  couple,
  airport,
  data,
}: {
  slug: string;
  couple: string;
  airport: string | null;
  data: GuestFlights;
}) {
  const t = useTranslations("flightForm");
  const [form, setForm] = useState(() => toForm(data.travel, airport));
  const [editing, setEditing] = useState(!shared(data.travel));
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const set = <K extends keyof GuestFlightsPayload>(key: K, value: GuestFlightsPayload[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // a flight with a number but no date/time can't go on the couple's board
    for (const [dir, label] of [
      ["arrival", t("arrival")],
      ["departure", t("departure")],
    ] as const) {
      const any = form[`${dir}_flight`] || form[`${dir}_date`] || form[`${dir}_time`];
      if (any && (!form[`${dir}_date`] || !form[`${dir}_time`])) {
        setError(t("needDateTime", { flight: label.toLowerCase() }));
        return;
      }
    }
    startTransition(async () => {
      const r = await submitGuestFlights(slug, data.household.code, form);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      toast.success(t("saved"));
      setEditing(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  const header = (
    <div className="text-center">
      <p className="font-serif text-3xl">{t("household", { name: data.household.name })}</p>
      <p className="text-muted-foreground mt-2">{t("intro", { couple })}</p>
    </div>
  );

  if (!editing) {
    return (
      <div className="space-y-6">
        {header}
        <Summary form={form} />
        <Button size="lg" variant="outline" className="w-full" onClick={() => setEditing(true)}>
          {t("edit")}
        </Button>
      </div>
    );
  }

  const placeholder = airport ? t("airportPlaceholder", { code: airport }) : t("fromPlaceholder");

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      {header}
      <div className="bg-card space-y-6 rounded-2xl border p-5 shadow-sm sm:p-7">
        <div className="flex items-center gap-3">
          <Plane className="text-primary-ink size-6 shrink-0" aria-hidden />
          <h2 className="text-2xl">{t("title")}</h2>
        </div>

        <fieldset className="space-y-3">
          <legend className="mb-3 flex items-center gap-2 font-medium">
            <PlaneLanding className="size-4" aria-hidden />
            {t("arrival")}
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="a-from" label={t("from")}>
              <Input
                id="a-from"
                maxLength={60}
                placeholder={t("fromPlaceholder")}
                value={form.arrival_from}
                onChange={(e) => set("arrival_from", e.target.value)}
              />
            </Field>
            <Field id="a-at" label={t("landingAt")}>
              <Input
                id="a-at"
                maxLength={10}
                placeholder={placeholder}
                value={form.arrival_airport}
                onChange={(e) => set("arrival_airport", e.target.value.toUpperCase())}
              />
            </Field>
            <Field id="a-date" label={t("date")}>
              <Input
                id="a-date"
                type="date"
                value={form.arrival_date ?? ""}
                onChange={(e) => set("arrival_date", e.target.value)}
              />
            </Field>
            <Field id="a-time" label={t("time")}>
              <Input
                id="a-time"
                type="time"
                value={form.arrival_time ?? ""}
                onChange={(e) => set("arrival_time", e.target.value)}
              />
            </Field>
            <Field id="a-flight" label={t("flightNumber")}>
              <Input
                id="a-flight"
                maxLength={20}
                placeholder={t("flightNumberPlaceholder")}
                value={form.arrival_flight}
                onChange={(e) => set("arrival_flight", e.target.value.toUpperCase())}
              />
            </Field>
          </div>
        </fieldset>

        <div className="border-t pt-6">
          <fieldset className="space-y-3">
            <legend className="mb-3 flex items-center gap-2 font-medium">
              <PlaneTakeoff className="size-4" aria-hidden />
              {t("departure")}
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="d-from" label={t("leavingFrom")}>
                <Input
                  id="d-from"
                  maxLength={10}
                  placeholder={placeholder}
                  value={form.departure_airport}
                  onChange={(e) => set("departure_airport", e.target.value.toUpperCase())}
                />
              </Field>
              <Field id="d-to" label={t("to")}>
                <Input
                  id="d-to"
                  maxLength={60}
                  placeholder={t("toPlaceholder")}
                  value={form.departure_to}
                  onChange={(e) => set("departure_to", e.target.value)}
                />
              </Field>
              <Field id="d-date" label={t("date")}>
                <Input
                  id="d-date"
                  type="date"
                  value={form.departure_date ?? ""}
                  onChange={(e) => set("departure_date", e.target.value)}
                />
              </Field>
              <Field id="d-time" label={t("time")}>
                <Input
                  id="d-time"
                  type="time"
                  value={form.departure_time ?? ""}
                  onChange={(e) => set("departure_time", e.target.value)}
                />
              </Field>
              <Field id="d-flight" label={t("flightNumber")}>
                <Input
                  id="d-flight"
                  maxLength={20}
                  placeholder={t("flightNumberPlaceholder")}
                  value={form.departure_flight}
                  onChange={(e) => set("departure_flight", e.target.value.toUpperCase())}
                />
              </Field>
            </div>
          </fieldset>
        </div>

        <div className="flex items-center gap-3 border-t pt-6">
          <Switch
            id="ride"
            checked={form.needs_transfer}
            onCheckedChange={(v) => set("needs_transfer", v)}
          />
          <Label htmlFor="ride" className="cursor-pointer">
            {t("needsRide")}
          </Label>
        </div>

        <Field id="notes" label={t("notes")}>
          <Textarea
            id="notes"
            rows={2}
            maxLength={500}
            placeholder={t("notesPlaceholder")}
            value={form.transport_notes}
            onChange={(e) => set("transport_notes", e.target.value)}
          />
        </Field>
      </div>

      {error && (
        <p role="alert" className="text-destructive text-center text-sm">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy && <Loader2 className="animate-spin" aria-hidden />}
        {t("save")}
      </Button>
      <p className="text-center text-sm">
        <Link href={`/w/${slug}/flights`} className="text-muted-foreground underline">
          {t("otherHousehold")}
        </Link>
      </p>
    </form>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

/** Read-only view after sending. */
function Summary({ form }: { form: GuestFlightsPayload }) {
  const t = useTranslations("flightForm");
  const locale = useLocale();
  const line = (dir: "arrival" | "departure") => {
    const date = form[`${dir}_date`];
    if (!date && !form[`${dir}_flight`]) return null;
    const route =
      dir === "arrival"
        ? [form.arrival_from, form.arrival_airport]
        : [form.departure_airport, form.departure_to];
    return (
      <li className="flex gap-3">
        {dir === "arrival" ? (
          <PlaneLanding className="text-primary-ink mt-0.5 size-5 shrink-0" aria-hidden />
        ) : (
          <PlaneTakeoff className="text-primary-ink mt-0.5 size-5 shrink-0" aria-hidden />
        )}
        <div>
          <p className="font-medium">{t(dir)}</p>
          <p className="text-muted-foreground text-sm">
            {[
              date && `${fmtDate(date, locale, "long")} ${form[`${dir}_time`] ?? ""}`.trim(),
              form[`${dir}_flight`],
              route.filter(Boolean).join(" → "),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </li>
    );
  };
  const arrival = line("arrival");
  const departure = line("departure");
  return (
    <div role="status" className="bg-card space-y-4 rounded-2xl border p-5 shadow-sm sm:p-7">
      <h2 className="flex items-center gap-2 text-2xl">
        <Check className="text-success size-6" aria-hidden />
        {t("title")}
      </h2>
      {arrival || departure ? (
        <ul className="space-y-3">
          {arrival}
          {departure}
          {form.needs_transfer && (
            <li className="flex gap-3 text-sm">
              <Car className="text-primary-ink size-5 shrink-0" aria-hidden />
              {t("needsRide")}
            </li>
          )}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">{t("summaryEmpty")}</p>
      )}
    </div>
  );
}
