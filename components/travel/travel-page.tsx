"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import {
  Car,
  Copy,
  Globe,
  Loader2,
  Mail,
  Plane,
  PlaneLanding,
  PlaneTakeoff,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  deleteFlight,
  saveFlight,
  sendTravelReminder,
  setDestinationAirport,
  setFlightPickup,
} from "@/app/app/travel/actions";
import { ShuttlePlanner } from "@/components/travel/shuttle-planner";
import { PageHeader } from "@/components/app/page-header";
import { MoneyInput } from "@/components/budget/money-input";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormField } from "@/components/form-field";
import { GuestPicker, type PickerGuest } from "@/components/guests/guest-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { FlightRow, GuestTravelRow } from "@/lib/database.types";
import { formatMoney } from "@/lib/budget/money";
import { fmtDate, fmtTime } from "@/lib/i18n/format";
import { FLIGHT_CATEGORIES, FLIGHT_DIRECTIONS } from "@/lib/places/labels";
import { shuttleArrivals } from "@/lib/places/shuttle";
import { groupByDay, iata, timeOf, toInputValue, type BoardFlight } from "@/lib/places/travel";
import { cn } from "@/lib/utils";
import { flightSchema, type FlightValues } from "@/lib/validation/places";

export type FlightItem = Omit<FlightRow, "price"> & {
  price: number | null;
  travellerIds: string[];
};

type HouseholdSummary = { id: string; name: string; rsvp_responded_at: string | null };

type Props = {
  flights: FlightItem[];
  guests: PickerGuest[];
  guestTravel: GuestTravelRow[];
  households: HouseholdSummary[];
  destinationAirport: string | null;
  currency: string;
  canEdit: boolean;
  /** link to the website's flight form, or null while it's switched off */
  flightFormUrl: string | null;
};

export function TravelPage({
  flights,
  guests,
  guestTravel,
  households,
  destinationAirport,
  currency,
  canEdit,
  flightFormUrl,
}: Props) {
  const t = useTranslations("travel");
  const fb = useTranslations("flightBoard");
  const [sheet, setSheet] = useState<string | { new: FlightValues["category"] } | null>(null);
  const guestName = new Map(guests.map((g) => [g.id, g.name]));
  const travellers = (f: FlightItem) => [
    ...f.travellerIds.map((id) => guestName.get(id) ?? t("guestFallback")),
    ...(f.other_travellers ? [f.other_travellers] : []),
  ];
  const toBoard = (f: FlightItem, dir: "arrival" | "departure"): BoardFlight => ({
    id: f.id,
    time: dir === "arrival" ? f.arrive_at : f.depart_at,
    flightNumber: f.flight_number,
    airline: f.airline,
    airport: dir === "arrival" ? f.from_airport : f.to_airport,
    travellers: travellers(f),
    needsPickup: f.needs_pickup,
    status: f.status,
    fromGuest: !!f.guest_travel_id,
    pickupRequested: f.pickup_requested,
  });
  const arrivals = flights
    .filter((f) => f.direction === "arrival" && f.category !== "honeymoon")
    .map((f) => toBoard(f, "arrival"));
  const departures = flights
    .filter((f) => f.direction === "departure" && f.category !== "honeymoon")
    .map((f) => toBoard(f, "departure"));
  const ours = flights.filter((f) => f.category !== "guest");
  const current = typeof sheet === "string" ? (flights.find((f) => f.id === sheet) ?? null) : null;
  const shuttle = shuttleArrivals(flights, (id) => guestName.get(id) ?? t("guestFallback"));
  const askedForRide = flights.filter(
    (f) => f.direction === "arrival" && f.pickup_requested && !f.needs_pickup,
  ).length;

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          canEdit && (
            <Button size="sm" onClick={() => setSheet({ new: "guest" })}>
              <Plus aria-hidden /> {t("add")}
            </Button>
          )
        }
      />

      <div className="space-y-6">
        <GuestFormCard
          url={flightFormUrl}
          destinationAirport={destinationAirport}
          canEdit={canEdit}
        />

        {askedForRide > 0 && (
          <p
            role="status"
            className="bg-tint-sand text-tint-sand-fg flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
          >
            <Car className="size-4 shrink-0" aria-hidden />
            {fb("toDecide", { count: askedForRide })}
          </p>
        )}

        <Tabs defaultValue="arrivals" className="gap-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="arrivals">
              <PlaneLanding aria-hidden /> {t("arrivals", { count: arrivals.length })}
            </TabsTrigger>
            <TabsTrigger value="departures">
              <PlaneTakeoff aria-hidden /> {t("departures", { count: departures.length })}
            </TabsTrigger>
            <TabsTrigger value="ours">
              <Plane aria-hidden /> {t("ours", { count: ours.length })}
            </TabsTrigger>
            <TabsTrigger value="all">{t("all", { count: flights.length })}</TabsTrigger>
            {guestTravel.length > 0 && (
              <TabsTrigger value="guestTravel">
                <Car aria-hidden /> {t("guestTravel", { count: guestTravel.length })}
              </TabsTrigger>
            )}
            <TabsTrigger value="shuttles">
              <Car aria-hidden /> {t("shuttles", { count: shuttle.length })}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="arrivals">
            <Board
              flights={arrivals}
              direction="arrival"
              onOpen={setSheet}
              canEdit={canEdit}
              onAdd={() => setSheet({ new: "guest" })}
            />
          </TabsContent>
          <TabsContent value="departures">
            <Board
              flights={departures}
              direction="departure"
              onOpen={setSheet}
              canEdit={canEdit}
              onAdd={() => setSheet({ new: "guest" })}
            />
          </TabsContent>
          <TabsContent value="ours">
            <FlightList
              flights={ours}
              travellers={travellers}
              currency={currency}
              onOpen={setSheet}
            />
            {canEdit && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setSheet({ new: "couple" })}>
                  <Plus aria-hidden /> {t("ourFlight")}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSheet({ new: "honeymoon" })}>
                  <Plus aria-hidden /> {t("honeymoonFlight")}
                </Button>
              </div>
            )}
          </TabsContent>
          <TabsContent value="all">
            <FlightList
              flights={flights}
              travellers={travellers}
              currency={currency}
              onOpen={setSheet}
            />
          </TabsContent>
          {guestTravel.length > 0 && (
            <TabsContent value="guestTravel">
              <GuestTravelList
                travel={guestTravel}
                households={households}
              />
            </TabsContent>
          )}
          <TabsContent value="shuttles">
            <ShuttlePlanner arrivals={shuttle} emptyText={fb("shuttleEmpty")} />
          </TabsContent>
        </Tabs>
      </div>

      <Sheet open={!!sheet} onOpenChange={(o) => !o && setSheet(null)}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
          {sheet && (
            <FlightForm
              key={typeof sheet === "string" ? sheet : `new-${sheet.new}`}
              flight={current}
              defaultCategory={typeof sheet === "string" ? "guest" : sheet.new}
              guests={guests}
              destinationAirport={destinationAirport}
              currency={currency}
              canEdit={canEdit}
              onClose={() => setSheet(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function GuestFormCard({
  url,
  destinationAirport,
  canEdit,
}: {
  url: string | null;
  destinationAirport: string | null;
  canEdit: boolean;
}) {
  const t = useTranslations("travel");
  const fb = useTranslations("flightBoard");
  const [airport, setAirport] = useState(destinationAirport ?? "");
  const [pending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-serif text-2xl">
          <Globe className="size-5" aria-hidden /> {fb("formTitle")}
        </CardTitle>
        <p className="text-muted-foreground text-sm">{fb("formText")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {url ? (
          <div className="space-y-1.5">
            <p className="text-sm">{fb("formOn")}</p>
            <div className="flex gap-2">
              <Input readOnly value={url} dir="ltr" onFocus={(e) => e.target.select()} />
              <Button
                variant="outline"
                onClick={() =>
                  navigator.clipboard
                    .writeText(url)
                    .then(() => toast.success(fb("copied")))
                    .catch(() => {})
                }
              >
                <Copy aria-hidden /> {fb("copy")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-muted flex flex-wrap items-center gap-3 rounded-lg p-3 text-sm">
            <p className="flex-1">{fb("formOff")}</p>
            <Button asChild variant="outline" size="sm">
              <Link href="/app/rsvp">{fb("openRsvpSettings")}</Link>
            </Button>
          </div>
        )}
        <div className="max-w-xs space-y-1.5">
          <Label htmlFor="wedding-airport">{fb("airportLabel")}</Label>
          <div className="flex gap-1">
            <Input
              id="wedding-airport"
              value={airport}
              maxLength={3}
              placeholder={t("toPlaceholder")}
              disabled={!canEdit}
              onChange={(e) => setAirport(e.target.value.toUpperCase())}
            />
            {canEdit &&
              (iata(airport) || airport === "") &&
              airport !== (destinationAirport ?? "") && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("saveAirport")}
                  title={t("saveAirport")}
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await setDestinationAirport(airport);
                      if (r.ok) toast.success(t("airportSaved", { code: airport }));
                      else toast.error(r.error);
                    })
                  }
                >
                  <Save aria-hidden />
                </Button>
              )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Board({
  flights,
  direction,
  onOpen,
  canEdit,
  onAdd,
}: {
  flights: BoardFlight[];
  direction: "arrival" | "departure";
  onOpen: (id: string) => void;
  canEdit: boolean;
  onAdd: () => void;
}) {
  const t = useTranslations("travel");
  const fb = useTranslations("flightBoard");
  const locale = useLocale();
  if (flights.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-dashed p-10 text-center">
        <p className="text-muted-foreground">
          {direction === "arrival" ? t("noArrivals") : t("noDepartures")}
        </p>
        {canEdit && (
          <Button className="mt-4" size="sm" onClick={onAdd}>
            <Plus aria-hidden /> {t("addAFlight")}
          </Button>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {groupByDay(flights, { locale, noTime: t("noTime") }).map((day) => (
        <section key={day.date ?? "none"} className="bg-card overflow-hidden rounded-xl border">
          <h3 className="bg-muted/50 flex items-baseline justify-between px-4 py-2 font-sans text-sm font-medium">
            {day.label}
            <span className="text-muted-foreground text-xs font-normal">
              {t("dayLine", { flights: day.flights.length, people: day.people })}
              {day.flights.some((f) => f.needsPickup) &&
                t("needPickup", { count: day.flights.filter((f) => f.needsPickup).length })}
            </span>
          </h3>
          <ul className="divide-y">
            {day.flights.map((f) => (
              <li key={f.id} className="flex items-center">
                <button
                  type="button"
                  onClick={() => onOpen(f.id)}
                  className={cn(
                    "hover:bg-accent focus-visible:ring-ring flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-start focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset",
                    f.status === "considering" && "opacity-70",
                  )}
                >
                  <span className="w-14 font-serif text-2xl font-medium tabular-nums">
                    {fmtTime(timeOf(f.time) || null, locale) || "–"}
                  </span>
                  <span className="w-28 text-sm">
                    <span className="block font-medium">{f.flightNumber ?? t("flight")}</span>
                    <span className="text-muted-foreground text-xs">
                      {t(direction === "arrival" ? "fromAirport" : "toAirport", {
                        code: f.airport ?? "?",
                      })}
                    </span>
                  </span>
                  <span className="min-w-40 flex-1 text-sm">
                    {f.travellers.join(", ") || (
                      <span className="text-muted-foreground">{t("noTravellers")}</span>
                    )}
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    {f.fromGuest && (
                      <span className="bg-muted rounded-full px-2 py-0.5 text-xs">
                        {fb("fromGuest")}
                      </span>
                    )}
                    {f.pickupRequested && !f.needsPickup && (
                      <span className="bg-tint-sand text-tint-sand-fg rounded-full px-2 py-0.5 text-xs font-medium">
                        {fb("asked")}
                      </span>
                    )}
                    {f.status === "considering" && (
                      <span className="bg-muted rounded-full px-2 py-0.5 text-xs">
                        {t("notBooked")}
                      </span>
                    )}
                  </span>
                </button>
                {direction === "arrival" && (
                  <ShuttleToggle key={`${f.id}-${f.needsPickup}`} flight={f} canEdit={canEdit} />
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** The couple's yes/no on an airport shuttle for one arrival. */
function ShuttleToggle({ flight, canEdit }: { flight: BoardFlight; canEdit: boolean }) {
  const fb = useTranslations("flightBoard");
  const [on, setOn] = useState(flight.needsPickup);
  const [pending, startTransition] = useTransition();
  const who = flight.travellers.join(", ") || flight.flightNumber || "";
  return (
    <label
      className={cn(
        "flex shrink-0 items-center gap-2 px-4 py-3 text-xs font-medium",
        on && "text-tint-sand-fg",
      )}
    >
      <Car className="size-4" aria-hidden />
      <span className="hidden sm:inline">{fb("shuttle")}</span>
      <Switch
        checked={on}
        disabled={!canEdit || pending}
        aria-label={on ? fb("shuttleOn") : fb("shuttleOff")}
        onCheckedChange={(v) => {
          setOn(v);
          startTransition(async () => {
            const r = await setFlightPickup(flight.id, v);
            if (!r.ok) {
              setOn(!v);
              toast.error(r.error);
            } else {
              toast.success(v ? fb("shuttleYes", { name: who }) : fb("shuttleNo", { name: who }));
            }
          });
        }}
      />
    </label>
  );
}

function FlightList({
  flights,
  travellers,
  currency,
  onOpen,
}: {
  flights: FlightItem[];
  travellers: (f: FlightItem) => string[];
  currency: string;
  onOpen: (id: string) => void;
}) {
  const t = useTranslations("travel");
  const p = useTranslations("places");
  const locale = useLocale();
  if (flights.length === 0)
    return (
      <p className="text-muted-foreground bg-card rounded-xl border border-dashed p-8 text-center text-sm">
        {t("noFlights")}
      </p>
    );
  const sorted = [...flights].sort((a, b) =>
    (a.depart_at ?? a.arrive_at ?? "~").localeCompare(b.depart_at ?? b.arrive_at ?? "~"),
  );
  return (
    <ul className="bg-card divide-y rounded-xl border">
      {sorted.map((f) => (
        <li key={f.id}>
          <button
            type="button"
            onClick={() => onOpen(f.id)}
            className="hover:bg-accent flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-start text-sm"
          >
            <span className="w-32">
              <span className="block font-medium">
                {f.from_airport ?? "?"} <span className="rtl:hidden">→</span>
                <span className="hidden rtl:inline">←</span> {f.to_airport ?? "?"}
              </span>
              <span className="text-muted-foreground text-xs">
                {f.depart_at
                  ? `${fmtDate(f.depart_at, locale, "medium")} ${fmtTime(timeOf(f.depart_at), locale)}`
                  : t("dateNotSet")}
              </span>
            </span>
            <span className="w-24">{[f.airline, f.flight_number].filter(Boolean).join(" ")}</span>
            <span className="min-w-40 flex-1 truncate">{travellers(f).join(", ")}</span>
            <span className="text-muted-foreground text-xs">
              {p(`flightCategory.${f.category}`)}
            </span>
            <span className="w-20 text-end tabular-nums">
              {f.price != null ? formatMoney(f.price, currency) : ""}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function FlightForm({
  flight,
  defaultCategory,
  guests,
  destinationAirport,
  currency,
  canEdit,
  onClose,
}: {
  flight: FlightItem | null;
  defaultCategory: FlightValues["category"];
  guests: PickerGuest[];
  destinationAirport: string | null;
  currency: string;
  canEdit: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("travel");
  const p = useTranslations("places");
  const fb = useTranslations("flightBoard");
  const [pending, startTransition] = useTransition();
  const form = useForm({
    resolver: zodResolver(flightSchema),
    defaultValues: {
      category: flight?.category ?? defaultCategory,
      direction: flight?.direction ?? (defaultCategory === "honeymoon" ? "other" : "arrival"),
      status: flight?.status ?? "booked",
      airline: flight?.airline ?? "",
      flightNumber: flight?.flight_number ?? "",
      fromAirport: flight?.from_airport ?? "",
      toAirport:
        flight?.to_airport ?? (defaultCategory === "honeymoon" ? "" : (destinationAirport ?? "")),
      departAt: toInputValue(flight?.depart_at ?? null),
      arriveAt: toInputValue(flight?.arrive_at ?? null),
      bookingRef: flight?.booking_ref ?? "",
      price: flight?.price ?? null,
      baggage: flight?.baggage ?? "",
      otherTravellers: flight?.other_travellers ?? "",
      needsPickup: flight?.needs_pickup ?? false,
      notes: flight?.notes ?? "",
      travellerIds: flight?.travellerIds ?? [],
    } satisfies FlightValues,
  });
  const { errors } = form.formState;
  const category = form.watch("category");

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const r = await saveFlight(values, flight?.id);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(flight ? t("saved") : t("added"));
      onClose();
    }),
  );

  const choose = <K extends "category" | "direction" | "status">(
    name: K,
    label: string,
    options: Record<string, string>,
  ) => (
    <FormField id={`f-${name}`} label={label}>
      {(aria) => (
        <Controller
          control={form.control}
          name={name}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger {...aria} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(options).map(([k, l]) => (
                  <SelectItem key={k} value={k}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      )}
    </FormField>
  );

  return (
    <>
      <SheetHeader className="border-b px-6 py-4">
        <SheetTitle className="font-serif text-3xl">
          {flight
            ? [flight.airline, flight.flight_number].filter(Boolean).join(" ") || t("flight")
            : t("addTitle")}
        </SheetTitle>
        <SheetDescription>
          {t("localTimes")}
          {flight?.guest_travel_id && <span className="mt-1 block">{fb("guestOwned")}</span>}
        </SheetDescription>
      </SheetHeader>
      <form
        id="flight-form"
        onSubmit={onSubmit}
        noValidate
        className="flex-1 overflow-y-auto px-6 py-6"
      >
        <fieldset disabled={!canEdit || pending} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            {choose(
              "category",
              t("for"),
              Object.fromEntries(FLIGHT_CATEGORIES.map((c) => [c, p(`flightCategory.${c}`)])),
            )}
            {choose(
              "direction",
              t("direction"),
              Object.fromEntries(FLIGHT_DIRECTIONS.map((d) => [d, p(`flightDirection.${d}`)])),
            )}
            {choose("status", t("status"), { booked: t("booked"), considering: t("considering") })}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="f-airline" label={t("airline")} error={errors.airline?.message}>
              {(aria) => <Input {...aria} {...form.register("airline")} />}
            </FormField>
            <FormField id="f-number" label={t("number")} error={errors.flightNumber?.message}>
              {(aria) => (
                <Input
                  {...aria}
                  placeholder={t("numberPlaceholder")}
                  {...form.register("flightNumber")}
                />
              )}
            </FormField>
            <FormField id="f-from" label={t("fromLabel")} error={errors.fromAirport?.message}>
              {(aria) => (
                <Input
                  {...aria}
                  placeholder={t("fromPlaceholder")}
                  {...form.register("fromAirport")}
                />
              )}
            </FormField>
            <FormField id="f-to" label={t("toLabel")} error={errors.toAirport?.message}>
              {(aria) => (
                <Input {...aria} placeholder={t("toPlaceholder")} {...form.register("toAirport")} />
              )}
            </FormField>
            <FormField id="f-dep" label={t("departs")} error={errors.departAt?.message}>
              {(aria) => <Input {...aria} type="datetime-local" {...form.register("departAt")} />}
            </FormField>
            <FormField id="f-arr" label={t("arrives")} error={errors.arriveAt?.message}>
              {(aria) => <Input {...aria} type="datetime-local" {...form.register("arriveAt")} />}
            </FormField>
            <FormField id="f-ref" label={t("reference")} error={errors.bookingRef?.message}>
              {(aria) => <Input {...aria} {...form.register("bookingRef")} />}
            </FormField>
            <FormField id="f-price" label={t("price")} error={errors.price?.message}>
              {(aria) => (
                <Controller
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <MoneyInput
                      {...aria}
                      currency={currency}
                      allowEmpty
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              )}
            </FormField>
          </div>
          <FormField id="f-bag" label={t("baggage")} error={errors.baggage?.message}>
            {(aria) => (
              <Input
                {...aria}
                placeholder={t("baggagePlaceholder")}
                {...form.register("baggage")}
              />
            )}
          </FormField>
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("travellersFromList")}</p>
            <Controller
              control={form.control}
              name="travellerIds"
              render={({ field }) => (
                <GuestPicker
                  guests={guests}
                  selected={field.value}
                  onChange={field.onChange}
                  maxHeight="12rem"
                />
              )}
            />
          </div>
          <FormField
            id="f-other"
            label={category === "guest" ? t("otherTravellers") : t("travellers")}
            hint={category === "guest" ? t("otherHint") : t("travellersHint")}
            error={errors.otherTravellers?.message}
          >
            {(aria) => <Input {...aria} {...form.register("otherTravellers")} />}
          </FormField>
          <Label className="justify-between font-normal">
            {t("pickupNeeded")}
            <Controller
              control={form.control}
              name="needsPickup"
              render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
          </Label>
          <FormField id="f-notes" label={p("notes")} error={errors.notes?.message}>
            {(aria) => <Textarea {...aria} rows={2} {...form.register("notes")} />}
          </FormField>
        </fieldset>
      </form>
      {canEdit && (
        <SheetFooter className="flex-row flex-wrap items-center gap-2 border-t px-6 py-4">
          {flight && (
            <ConfirmDialog
              trigger={
                <Button variant="ghost" className="text-destructive me-auto" disabled={pending}>
                  <Trash2 aria-hidden /> {p("delete")}
                </Button>
              }
              title={t("deleteTitle")}
              description={t("deleteText")}
              onConfirm={async () => {
                const r = await deleteFlight(flight.id);
                if (!r.ok) {
                  toast.error(r.error);
                  return false;
                }
                onClose();
              }}
            />
          )}
          <div className="ms-auto flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={pending}>
              {p("cancel")}
            </Button>
            <Button type="submit" form="flight-form" disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              {flight ? p("save") : t("add")}
            </Button>
          </div>
        </SheetFooter>
      )}
    </>
  );
}

function GuestTravelList({
  travel,
  households,
}: {
  travel: GuestTravelRow[];
  households: HouseholdSummary[];
}) {
  const t = useTranslations("travel");
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const hhName = new Map(households.map((h) => [h.id, h.name]));
  const needsTransfer = travel.filter((gt) => gt.needs_transfer);
  const travelHhIds = new Set(travel.map((gt) => gt.household_id));
  const responded = households.filter((h) => h.rsvp_responded_at);
  const noTravel = responded.filter((h) => !travelHhIds.has(h.id));

  const remind = () =>
    startTransition(async () => {
      if (noTravel.length === 0) return;
      const r = await sendTravelReminder(noTravel.map((h) => h.id));
      if (r.ok) toast.success(t("gt.reminded", { count: r.data.sent }));
      else toast.error(r.error);
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="bg-card rounded-xl border px-4 py-3 text-sm">
          <span className="text-muted-foreground">{t("gt.shared")}</span>{" "}
          <strong>{travel.length}</strong>
        </div>
        {needsTransfer.length > 0 && (
          <div className="bg-card rounded-xl border px-4 py-3 text-sm">
            <Car className="mr-1 inline size-4" aria-hidden />
            <span className="text-muted-foreground">{t("gt.needTransfer")}</span>{" "}
            <strong>{needsTransfer.length}</strong>
          </div>
        )}
        {noTravel.length > 0 && (
          <Button variant="outline" size="sm" onClick={remind} disabled={pending} className="ml-auto">
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Mail aria-hidden />}
            {t("gt.remind", { count: noTravel.length })}
          </Button>
        )}
      </div>
      <div className="space-y-3">
        {travel.map((gt) => (
          <div key={gt.id} className="bg-card rounded-xl border p-4">
            <h3 className="font-medium">{hhName.get(gt.household_id) ?? t("gt.unknown")}</h3>
            <div className="text-muted-foreground mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              {gt.arrival_date && (
                <div>
                  <PlaneLanding className="mr-1 inline size-3.5" aria-hidden />
                  {fmtDate(gt.arrival_date, locale, "medium")}
                  {gt.arrival_time && ` ${gt.arrival_time.slice(0, 5)}`}
                  {gt.arrival_airport && ` (${gt.arrival_airport})`}
                  {gt.arrival_flight && ` · ${gt.arrival_flight}`}
                </div>
              )}
              {gt.departure_date && (
                <div>
                  <PlaneTakeoff className="mr-1 inline size-3.5" aria-hidden />
                  {fmtDate(gt.departure_date, locale, "medium")}
                  {gt.departure_time && ` ${gt.departure_time.slice(0, 5)}`}
                  {gt.departure_airport && ` (${gt.departure_airport})`}
                  {gt.departure_flight && ` · ${gt.departure_flight}`}
                </div>
              )}
              {gt.staying_at && <div>{gt.staying_at}</div>}
              {gt.needs_transfer && (
                <div>
                  <Car className="mr-1 inline size-3.5" aria-hidden />
                  {t("gt.transferRequested")}
                </div>
              )}
              {gt.transport_notes && <div className="sm:col-span-2">{gt.transport_notes}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
