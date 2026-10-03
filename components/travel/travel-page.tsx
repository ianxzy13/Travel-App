"use client";

import { useEffect, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { addDays, format, parseISO } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import {
  Car,
  ExternalLink,
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
import {
  flightSearchLinks,
  groupByDay,
  iata,
  timeOf,
  toInputValue,
  type BoardFlight,
} from "@/lib/places/travel";
import { getFareHints, type FareHint } from "@/lib/places/fares";
import { cn } from "@/lib/utils";
import { hasAnyAffiliate } from "@/lib/vendors/search-links";
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
  weddingDate: string | null;
  currency: string;
  canEdit: boolean;
};

export function TravelPage({
  flights,
  guests,
  guestTravel,
  households,
  destinationAirport,
  weddingDate,
  currency,
  canEdit,
}: Props) {
  const t = useTranslations("travel");
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
  });
  const arrivals = flights
    .filter((f) => f.direction === "arrival" && f.category !== "honeymoon")
    .map((f) => toBoard(f, "arrival"));
  const departures = flights
    .filter((f) => f.direction === "departure" && f.category !== "honeymoon")
    .map((f) => toBoard(f, "departure"));
  const ours = flights.filter((f) => f.category !== "guest");
  const current = typeof sheet === "string" ? (flights.find((f) => f.id === sheet) ?? null) : null;
  const hhName = new Map(households.map((h) => [h.id, h.name]));
  const enrichedTravel = guestTravel.map((gt) => ({
    ...gt,
    householdName: hhName.get(gt.household_id) ?? "",
  }));
  const shuttleCount = guestTravel.filter((gt) => gt.needs_transfer).length;

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
        <SearchFlights
          destinationAirport={destinationAirport}
          weddingDate={weddingDate}
          canEdit={canEdit}
        />

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
            {shuttleCount > 0 && (
              <TabsTrigger value="shuttles">
                <Car aria-hidden /> {t("shuttles", { count: shuttleCount })}
              </TabsTrigger>
            )}
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
          {shuttleCount > 0 && (
            <TabsContent value="shuttles">
              <ShuttlePlanner guestTravel={enrichedTravel} />
            </TabsContent>
          )}
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

function SearchFlights({
  destinationAirport,
  weddingDate,
  canEdit,
}: {
  destinationAirport: string | null;
  weddingDate: string | null;
  canEdit: boolean;
}) {
  const t = useTranslations("travel");
  const shift = (d: string | null, n: number) =>
    d ? format(addDays(parseISO(d), n), "yyyy-MM-dd") : "";
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(destinationAirport ?? "");
  const [depart, setDepart] = useState(shift(weddingDate, -2));
  const [ret, setRet] = useState(shift(weddingDate, 2));
  const [pending, startTransition] = useTransition();
  const links = to.trim() ? flightSearchLinks({ from, to, depart, ret }) : null;
  const [fares, setFares] = useState<FareHint[]>([]);

  useEffect(() => {
    const f = from.trim();
    const d = to.trim();
    if (f.length === 3 && d.length === 3) {
      getFareHints(f, d, depart || null).then(setFares);
    } else {
      setFares([]);
    }
  }, [from, to, depart]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-2xl">{t("search")}</CardTitle>
        <p className="text-muted-foreground text-sm">{t("searchHint")}</p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_1fr]">
          <div className="space-y-1.5">
            <Label htmlFor="sf-from">{t("from")}</Label>
            <Input
              id="sf-from"
              value={from}
              maxLength={3}
              placeholder={t("fromPlaceholder")}
              onChange={(e) => setFrom(e.target.value.toUpperCase())}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sf-to">{t("to")}</Label>
            <div className="flex gap-1">
              <Input
                id="sf-to"
                value={to}
                maxLength={3}
                placeholder={t("toPlaceholder")}
                onChange={(e) => setTo(e.target.value.toUpperCase())}
              />
              {canEdit && iata(to) && iata(to) !== destinationAirport && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("saveAirport")}
                  title={t("saveAirport")}
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await setDestinationAirport(to);
                      if (r.ok) toast.success(t("airportSaved", { code: to }));
                      else toast.error(r.error);
                    })
                  }
                >
                  <Save aria-hidden />
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sf-depart">{t("out")}</Label>
            <Input
              id="sf-depart"
              type="date"
              value={depart}
              onChange={(e) => setDepart(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sf-ret">{t("back")}</Label>
            <Input id="sf-ret" type="date" value={ret} onChange={(e) => setRet(e.target.value)} />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild={!!links} disabled={!links} variant="outline" size="sm">
            {links ? (
              <a href={links.google} target="_blank" rel="sponsored noopener noreferrer">
                <ExternalLink aria-hidden /> Google Flights
              </a>
            ) : (
              <span>Google Flights</span>
            )}
          </Button>
          <Button
            asChild={!!links?.skyscanner}
            disabled={!links?.skyscanner}
            variant="outline"
            size="sm"
          >
            {links?.skyscanner ? (
              <a href={links.skyscanner} target="_blank" rel="sponsored noopener noreferrer">
                <ExternalLink aria-hidden /> Skyscanner
              </a>
            ) : (
              <span>{t("skyscannerNeeds")}</span>
            )}
          </Button>
          {links?.aviasales && (
            <Button asChild variant="outline" size="sm">
              <a href={links.aviasales} target="_blank" rel="sponsored noopener noreferrer">
                <ExternalLink aria-hidden /> Aviasales
              </a>
            </Button>
          )}
          {hasAnyAffiliate() && (
            <p className="text-muted-foreground mt-2 text-xs">{t("affiliateDisclosure")}</p>
          )}
        </div>
        {fares.length > 0 && (
          <div className="mt-4 rounded-lg border p-3">
            <p className="text-muted-foreground mb-2 text-xs font-medium">{t("fareHintsTitle")}</p>
            <ul className="space-y-1 text-sm">
              {fares.map((f, i) => (
                <li key={i} className="flex justify-between">
                  <span>
                    {f.origin} → {f.destination}
                    {f.airline && <span className="text-muted-foreground ml-1">({f.airline})</span>}
                  </span>
                  <span className="font-medium">~€{Math.round(f.price_eur)}</span>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground mt-2 text-[11px]">{t("fareHintsDisclaimer")}</p>
          </div>
        )}
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
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => onOpen(f.id)}
                  className={cn(
                    "hover:bg-accent focus-visible:ring-ring flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-start focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset",
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
                  <span className="flex gap-1.5">
                    {f.needsPickup && (
                      <span className="bg-tint-sand text-tint-sand-fg rounded-full px-2 py-0.5 text-xs font-medium">
                        <Car className="me-1 inline size-3" aria-hidden />
                        {t("pickup")}
                      </span>
                    )}
                    {f.status === "considering" && (
                      <span className="bg-muted rounded-full px-2 py-0.5 text-xs">
                        {t("notBooked")}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
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
        <SheetDescription>{t("localTimes")}</SheetDescription>
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
