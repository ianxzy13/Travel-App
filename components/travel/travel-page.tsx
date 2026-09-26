"use client";

import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { addDays, format, parseISO } from "date-fns";
import {
  Car,
  ExternalLink,
  Loader2,
  Plane,
  PlaneLanding,
  PlaneTakeoff,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { deleteFlight, saveFlight, setDestinationAirport } from "@/app/app/travel/actions";
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
import type { FlightRow } from "@/lib/database.types";
import { formatMoney } from "@/lib/budget/money";
import { FLIGHT_CATEGORY, FLIGHT_DIRECTION } from "@/lib/places/labels";
import {
  flightSearchLinks,
  groupByDay,
  iata,
  timeOf,
  toInputValue,
  type BoardFlight,
} from "@/lib/places/travel";
import { cn } from "@/lib/utils";
import { flightSchema, type FlightValues } from "@/lib/validation/places";

export type FlightItem = Omit<FlightRow, "price"> & {
  price: number | null;
  travellerIds: string[];
};

type Props = {
  flights: FlightItem[];
  guests: PickerGuest[];
  destinationAirport: string | null;
  weddingDate: string | null;
  currency: string;
  canEdit: boolean;
};

export function TravelPage({
  flights,
  guests,
  destinationAirport,
  weddingDate,
  currency,
  canEdit,
}: Props) {
  const [sheet, setSheet] = useState<string | { new: FlightValues["category"] } | null>(null);
  const guestName = new Map(guests.map((g) => [g.id, g.name]));
  const travellers = (f: FlightItem) => [
    ...f.travellerIds.map((id) => guestName.get(id) ?? "Guest"),
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

  return (
    <>
      <PageHeader
        title="Travel"
        description="Flights for your guests, for the two of you, and the honeymoon."
        actions={
          canEdit && (
            <Button size="sm" onClick={() => setSheet({ new: "guest" })}>
              <Plus aria-hidden /> Add flight
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
              <PlaneLanding aria-hidden /> Arrivals ({arrivals.length})
            </TabsTrigger>
            <TabsTrigger value="departures">
              <PlaneTakeoff aria-hidden /> Departures ({departures.length})
            </TabsTrigger>
            <TabsTrigger value="ours">
              <Plane aria-hidden /> Us &amp; honeymoon ({ours.length})
            </TabsTrigger>
            <TabsTrigger value="all">All flights ({flights.length})</TabsTrigger>
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
                  <Plus aria-hidden /> Our flight
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSheet({ new: "honeymoon" })}>
                  <Plus aria-hidden /> Honeymoon flight
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
  const shift = (d: string | null, n: number) =>
    d ? format(addDays(parseISO(d), n), "yyyy-MM-dd") : "";
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(destinationAirport ?? "");
  const [depart, setDepart] = useState(shift(weddingDate, -2));
  const [ret, setRet] = useState(shift(weddingDate, 2));
  const [pending, startTransition] = useTransition();
  const links = to.trim() ? flightSearchLinks({ from, to, depart, ret }) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-2xl">Search flights</CardTitle>
        <p className="text-muted-foreground text-sm">
          Opens Google Flights or Skyscanner with your trip filled in. Use 3-letter airport codes
          (e.g. LHR, LIS).
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_1fr]">
          <div className="space-y-1.5">
            <Label htmlFor="sf-from">From</Label>
            <Input
              id="sf-from"
              value={from}
              maxLength={3}
              placeholder="e.g. LHR"
              onChange={(e) => setFrom(e.target.value.toUpperCase())}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sf-to">To (your wedding)</Label>
            <div className="flex gap-1">
              <Input
                id="sf-to"
                value={to}
                maxLength={3}
                placeholder="e.g. LIS"
                onChange={(e) => setTo(e.target.value.toUpperCase())}
              />
              {canEdit && iata(to) && iata(to) !== destinationAirport && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Save as our airport"
                  title="Save as our airport"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await setDestinationAirport(to);
                      if (r.ok) toast.success(`${to} saved as your airport`);
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
            <Label htmlFor="sf-depart">Out</Label>
            <Input
              id="sf-depart"
              type="date"
              value={depart}
              onChange={(e) => setDepart(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sf-ret">Back</Label>
            <Input id="sf-ret" type="date" value={ret} onChange={(e) => setRet(e.target.value)} />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild={!!links} disabled={!links} variant="outline" size="sm">
            {links ? (
              <a href={links.google} target="_blank" rel="noreferrer">
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
              <a href={links.skyscanner} target="_blank" rel="noreferrer">
                <ExternalLink aria-hidden /> Skyscanner
              </a>
            ) : (
              <span>Skyscanner (needs codes + date)</span>
            )}
          </Button>
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
  if (flights.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-dashed p-10 text-center">
        <p className="text-muted-foreground">
          No {direction === "arrival" ? "arrivals" : "departures"} yet. Add guests&apos; flights to
          plan airport pickups and shuttles.
        </p>
        {canEdit && (
          <Button className="mt-4" size="sm" onClick={onAdd}>
            <Plus aria-hidden /> Add a flight
          </Button>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {groupByDay(flights).map((day) => (
        <section key={day.date ?? "none"} className="bg-card overflow-hidden rounded-xl border">
          <h3 className="bg-muted/50 flex items-baseline justify-between px-4 py-2 font-sans text-sm font-medium">
            {day.label}
            <span className="text-muted-foreground text-xs font-normal">
              {day.flights.length} flight{day.flights.length === 1 ? "" : "s"} · {day.people} people
              {day.flights.some((f) => f.needsPickup) &&
                ` · ${day.flights.filter((f) => f.needsPickup).length} need pickup`}
            </span>
          </h3>
          <ul className="divide-y">
            {day.flights.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => onOpen(f.id)}
                  className={cn(
                    "hover:bg-accent focus-visible:ring-ring flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset",
                    f.status === "considering" && "opacity-70",
                  )}
                >
                  <span className="w-14 font-serif text-2xl font-semibold tabular-nums">
                    {timeOf(f.time) || "–"}
                  </span>
                  <span className="w-28 text-sm">
                    <span className="block font-medium">{f.flightNumber ?? "Flight"}</span>
                    <span className="text-muted-foreground text-xs">
                      {direction === "arrival" ? "from" : "to"} {f.airport ?? "?"}
                    </span>
                  </span>
                  <span className="min-w-40 flex-1 text-sm">
                    {f.travellers.join(", ") || (
                      <span className="text-muted-foreground">No travellers added</span>
                    )}
                  </span>
                  <span className="flex gap-1.5">
                    {f.needsPickup && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                        <Car className="mr-1 inline size-3" aria-hidden />
                        Pickup
                      </span>
                    )}
                    {f.status === "considering" && (
                      <span className="bg-muted rounded-full px-2 py-0.5 text-xs">Not booked</span>
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
  if (flights.length === 0)
    return (
      <p className="text-muted-foreground bg-card rounded-xl border border-dashed p-8 text-center text-sm">
        No flights here yet.
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
            className="hover:bg-accent flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left text-sm"
          >
            <span className="w-32">
              <span className="block font-medium">
                {f.from_airport ?? "?"} → {f.to_airport ?? "?"}
              </span>
              <span className="text-muted-foreground text-xs">
                {f.depart_at ? format(parseISO(f.depart_at), "d MMM HH:mm") : "Date not set"}
              </span>
            </span>
            <span className="w-24">{[f.airline, f.flight_number].filter(Boolean).join(" ")}</span>
            <span className="min-w-40 flex-1 truncate">{travellers(f).join(", ")}</span>
            <span className="text-muted-foreground text-xs">{FLIGHT_CATEGORY[f.category]}</span>
            <span className="w-20 text-right tabular-nums">
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
      toast.success(flight ? "Flight saved" : "Flight added");
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
            ? [flight.airline, flight.flight_number].filter(Boolean).join(" ") || "Flight"
            : "Add a flight"}
        </SheetTitle>
        <SheetDescription>
          Times are local at each airport, as shown on the ticket.
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
            {choose("category", "For", { guest: "Guests", couple: "Us", honeymoon: "Honeymoon" })}
            {choose("direction", "Direction", FLIGHT_DIRECTION)}
            {choose("status", "Status", { booked: "Booked", considering: "Considering" })}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="f-airline" label="Airline" error={errors.airline?.message}>
              {(aria) => <Input {...aria} {...form.register("airline")} />}
            </FormField>
            <FormField id="f-number" label="Flight number" error={errors.flightNumber?.message}>
              {(aria) => (
                <Input {...aria} placeholder="e.g. TP1351" {...form.register("flightNumber")} />
              )}
            </FormField>
            <FormField id="f-from" label="From (airport)" error={errors.fromAirport?.message}>
              {(aria) => (
                <Input {...aria} placeholder="e.g. LHR" {...form.register("fromAirport")} />
              )}
            </FormField>
            <FormField id="f-to" label="To (airport)" error={errors.toAirport?.message}>
              {(aria) => <Input {...aria} placeholder="e.g. LIS" {...form.register("toAirport")} />}
            </FormField>
            <FormField id="f-dep" label="Departs (local time)" error={errors.departAt?.message}>
              {(aria) => <Input {...aria} type="datetime-local" {...form.register("departAt")} />}
            </FormField>
            <FormField id="f-arr" label="Arrives (local time)" error={errors.arriveAt?.message}>
              {(aria) => <Input {...aria} type="datetime-local" {...form.register("arriveAt")} />}
            </FormField>
            <FormField id="f-ref" label="Booking reference" error={errors.bookingRef?.message}>
              {(aria) => <Input {...aria} {...form.register("bookingRef")} />}
            </FormField>
            <FormField id="f-price" label="Price" error={errors.price?.message}>
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
          <FormField id="f-bag" label="Baggage" error={errors.baggage?.message}>
            {(aria) => (
              <Input
                {...aria}
                placeholder="e.g. 1 × 23 kg + dress bag"
                {...form.register("baggage")}
              />
            )}
          </FormField>
          <div className="space-y-2">
            <p className="text-sm font-medium">Travellers from your guest list</p>
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
            label={category === "guest" ? "Other travellers" : "Travellers"}
            hint={category === "guest" ? "People not on the guest list." : "e.g. Ian & Maria"}
            error={errors.otherTravellers?.message}
          >
            {(aria) => <Input {...aria} {...form.register("otherTravellers")} />}
          </FormField>
          <Label className="justify-between font-normal">
            Needs an airport pickup
            <Controller
              control={form.control}
              name="needsPickup"
              render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
          </Label>
          <FormField id="f-notes" label="Notes" error={errors.notes?.message}>
            {(aria) => <Textarea {...aria} rows={2} {...form.register("notes")} />}
          </FormField>
        </fieldset>
      </form>
      {canEdit && (
        <SheetFooter className="flex-row flex-wrap items-center gap-2 border-t px-6 py-4">
          {flight && (
            <ConfirmDialog
              trigger={
                <Button variant="ghost" className="text-destructive mr-auto" disabled={pending}>
                  <Trash2 aria-hidden /> Delete
                </Button>
              }
              title="Delete this flight?"
              description="This can't be undone."
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
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" form="flight-form" disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              {flight ? "Save" : "Add flight"}
            </Button>
          </div>
        </SheetFooter>
      )}
    </>
  );
}
