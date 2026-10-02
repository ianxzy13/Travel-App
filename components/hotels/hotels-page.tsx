"use client";

import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlarmClock,
  BedDouble,
  Copy,
  ExternalLink,
  Globe,
  Heart,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { deleteHotel, saveHotel, setHotelGuests } from "@/app/app/hotels/actions";
import { PageHeader } from "@/components/app/page-header";
import { MoneyInput } from "@/components/budget/money-input";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormField } from "@/components/form-field";
import { GuestPicker, type PickerGuest } from "@/components/guests/guest-picker";
import { Button } from "@/components/ui/button";
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
import type { HotelGuestRow, HotelRow } from "@/lib/database.types";
import { formatMoney } from "@/lib/budget/money";
import { fmtDate } from "@/lib/i18n/format";
import { HOTEL_STATUS_CLASS } from "@/lib/places/labels";
import { roomBlockState } from "@/lib/places/travel";
import { cn } from "@/lib/utils";
import { bookingSearch } from "@/lib/vendors/search-links";
import { hotelSchema, type HotelValues } from "@/lib/validation/places";

export type HotelItem = Omit<HotelRow, "price_per_night"> & { price_per_night: number | null };
type Stay = Pick<HotelGuestRow, "hotel_id" | "guest_id" | "room" | "check_in" | "check_out">;

type Props = {
  hotels: HotelItem[];
  stays: Stay[];
  guests: (PickerGuest & { attending: boolean })[];
  currency: string;
  location: string | null;
  canEdit: boolean;
  today: string;
};

function useCopy() {
  const t = useTranslations("hotels");
  return async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("copied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  };
}

export function HotelsPage({ hotels, stays, guests, currency, location, canEdit, today }: Props) {
  const t = useTranslations("hotels");
  const p = useTranslations("places");
  const locale = useLocale();
  const copy = useCopy();
  const [sheet, setSheet] = useState<string | "new" | null>(null);
  const current = sheet && sheet !== "new" ? (hotels.find((h) => h.id === sheet) ?? null) : null;
  const guestName = new Map(guests.map((g) => [g.id, g.name]));
  const hotelName = new Map(hotels.map((h) => [h.id, h.name]));
  const reminders = hotels
    .filter((h) => h.status !== "rejected")
    .map((h) => ({ h, s: roomBlockState(h, today) }))
    .filter((x) => x.s.level === "soon");
  const attendingWithoutHotel = guests.filter(
    (g) => g.attending && !stays.some((s) => s.guest_id === g.id),
  ).length;

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <div className="flex gap-2">
            {location && (
              <Button asChild variant="outline" size="sm">
                <a
                  href={bookingSearch(`hotels ${location}`)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <BedDouble aria-hidden /> {t("findOnBooking")}
                </a>
              </Button>
            )}
            {canEdit && (
              <Button size="sm" onClick={() => setSheet("new")}>
                <Plus aria-hidden /> {t("add")}
              </Button>
            )}
          </div>
        }
      />

      {reminders.length > 0 && (
        <div role="status" className="bg-warning/10 mb-6 space-y-1 rounded-xl p-4 text-sm">
          {reminders.map(({ h, s }) => (
            <p key={h.id} className="flex items-center gap-2">
              <AlarmClock className="text-warning size-4 shrink-0" aria-hidden />
              <span>
                {t.rich("cutoffSoon", {
                  name: h.name,
                  days: s.daysLeft ?? 0,
                  b: (c) => <strong>{c}</strong>,
                })}{" "}
                {s.free != null && t("roomsFree", { count: s.free })} {t("remind")}
              </span>
            </p>
          ))}
        </div>
      )}

      {hotels.length === 0 ? (
        <div className="bg-card flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-16 text-center">
          <span className="bg-primary-soft text-primary-ink inline-flex size-14 items-center justify-center rounded-full">
            <BedDouble className="size-7" aria-hidden />
          </span>
          <h2 className="text-3xl">{t("emptyTitle")}</h2>
          <p className="text-muted-foreground max-w-sm">{t("emptyText")}</p>
          {canEdit && (
            <Button onClick={() => setSheet("new")}>
              <Plus aria-hidden /> {t("addFirst")}
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-4">
            {hotels.map((h) => {
              const s = roomBlockState(h, today);
              const count = stays.filter((x) => x.hotel_id === h.id).length;
              const pct = h.rooms_held
                ? Math.min(100, ((h.rooms_booked ?? 0) / h.rooms_held) * 100)
                : 0;
              return (
                <li key={h.id} className="bg-card flex flex-col rounded-xl border">
                  <button
                    type="button"
                    onClick={() => setSheet(h.id)}
                    className="focus-visible:ring-ring flex flex-1 flex-col gap-2 rounded-xl p-4 text-start focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <div className="flex flex-wrap gap-1.5">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          HOTEL_STATUS_CLASS[h.status],
                        )}
                      >
                        {p(`hotelStatus.${h.status}`)}
                      </span>
                      {h.for_couple && (
                        <span className="bg-primary-soft rounded-full px-2 py-0.5 text-xs font-medium">
                          <Heart className="me-1 inline size-3" aria-hidden />
                          {t("ours")}
                        </span>
                      )}
                      {h.show_on_website && (
                        <span className="bg-muted rounded-full px-2 py-0.5 text-xs">
                          <Globe className="me-1 inline size-3" aria-hidden />
                          {t("onWebsite")}
                        </span>
                      )}
                    </div>
                    <p className="font-serif text-2xl leading-tight font-medium">{h.name}</p>
                    <p className="text-muted-foreground text-sm">
                      {[
                        h.distance,
                        h.price_per_night != null &&
                          t("perNight", { price: formatMoney(h.price_per_night, currency) }),
                      ]
                        .filter(Boolean)
                        .join(" · ") || " "}
                    </p>
                    {h.rooms_held != null && (
                      <div>
                        <p className="text-xs tabular-nums">
                          {t("block", { booked: h.rooms_booked ?? 0, held: h.rooms_held })}
                        </p>
                        <div className="bg-muted mt-1 h-1.5 rounded-full">
                          <div
                            className="bg-primary h-1.5 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {h.cutoff_date && (
                      <p
                        className={cn(
                          "text-xs",
                          s.level === "soon"
                            ? "text-warning font-medium"
                            : s.level === "passed"
                              ? "text-muted-foreground line-through"
                              : "text-muted-foreground",
                        )}
                      >
                        {s.level === "soon" && (
                          <AlarmClock className="me-1 inline size-3" aria-hidden />
                        )}
                        {t("cutoff", { date: fmtDate(h.cutoff_date, locale, "medium") })}
                        {s.level === "passed"
                          ? t("passed")
                          : s.daysLeft != null && t("daysLeft", { count: s.daysLeft })}
                      </p>
                    )}
                    <p className="text-muted-foreground mt-auto pt-2 text-xs">
                      {t("staying", { count })}
                    </p>
                  </button>
                  {(h.discount_code || h.booking_url) && (
                    <div className="flex flex-wrap gap-2 border-t p-3">
                      {h.discount_code && (
                        <Button variant="outline" size="sm" onClick={() => copy(h.discount_code!)}>
                          <Copy aria-hidden /> {t("code", { code: h.discount_code })}
                        </Button>
                      )}
                      {h.booking_url && (
                        <Button asChild variant="ghost" size="sm">
                          <a href={h.booking_url} target="_blank" rel="noreferrer">
                            <ExternalLink aria-hidden /> {t("bookingLink")}
                          </a>
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <section className="space-y-3">
            <h2 className="text-3xl">{t("whoWhere")}</h2>
            {stays.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("nobody")}</p>
            ) : (
              <div className="bg-card overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground text-start text-xs">
                    <tr>
                      <th className="px-3 py-2 text-start font-medium">{t("guest")}</th>
                      <th className="px-3 py-2 text-start font-medium">{t("hotel")}</th>
                      <th className="px-3 py-2 text-start font-medium">{t("room")}</th>
                      <th className="px-3 py-2 text-start font-medium">{t("dates")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {[...stays]
                      .sort((a, b) =>
                        (guestName.get(a.guest_id) ?? "").localeCompare(
                          guestName.get(b.guest_id) ?? "",
                        ),
                      )
                      .map((s) => (
                        <tr key={s.guest_id}>
                          <td className="px-3 py-2">{guestName.get(s.guest_id)}</td>
                          <td className="px-3 py-2">{hotelName.get(s.hotel_id)}</td>
                          <td className="px-3 py-2">{s.room}</td>
                          <td className="text-muted-foreground px-3 py-2 whitespace-nowrap">
                            {s.check_in && fmtDate(s.check_in, locale, "medium")}
                            {s.check_out && ` – ${fmtDate(s.check_out, locale, "medium")}`}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
            {attendingWithoutHotel > 0 && (
              <p className="text-muted-foreground text-sm">
                {t("noHotel", { count: attendingWithoutHotel })}
              </p>
            )}
          </section>
        </div>
      )}

      <Sheet open={!!sheet} onOpenChange={(o) => !o && setSheet(null)}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
          {sheet && (
            <HotelForm
              key={sheet}
              hotel={current}
              stays={stays}
              guests={guests.map((g) => {
                const at = stays.find((s) => s.guest_id === g.id);
                return {
                  ...g,
                  note:
                    at && at.hotel_id !== current?.id
                      ? t("atHotel", { name: hotelName.get(at.hotel_id) ?? "" })
                      : undefined,
                };
              })}
              currency={currency}
              canEdit={canEdit}
              onClose={() => setSheet(null)}
              onCreated={(id) => setSheet(id)}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function HotelForm({
  hotel,
  stays,
  guests,
  currency,
  canEdit,
  onClose,
  onCreated,
}: {
  hotel: HotelItem | null;
  stays: Stay[];
  guests: PickerGuest[];
  currency: string;
  canEdit: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const t = useTranslations("hotels");
  const p = useTranslations("places");
  const [pending, startTransition] = useTransition();
  const form = useForm({
    resolver: zodResolver(hotelSchema),
    defaultValues: {
      name: hotel?.name ?? "",
      status: hotel?.status ?? "considering",
      address: hotel?.address ?? "",
      distance: hotel?.distance ?? "",
      website: hotel?.website ?? "",
      bookingUrl: hotel?.booking_url ?? "",
      pricePerNight: hotel?.price_per_night ?? null,
      roomsHeld: hotel?.rooms_held ?? null,
      roomsBooked: hotel?.rooms_booked ?? null,
      discountCode: hotel?.discount_code ?? "",
      cutoffDate: hotel?.cutoff_date ?? "",
      showOnWebsite: hotel?.show_on_website ?? false,
      forCouple: hotel?.for_couple ?? false,
      notes: hotel?.notes ?? "",
    } satisfies HotelValues,
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const r = await saveHotel(values, hotel?.id);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(hotel ? t("saved") : t("added"));
      if (hotel) onClose();
      else onCreated(r.data.id);
    }),
  );

  const numberField = (name: "roomsHeld" | "roomsBooked", label: string) => (
    <FormField id={`h-${name}`} label={label} error={errors[name]?.message}>
      {(aria) => (
        <Controller
          control={form.control}
          name={name}
          render={({ field }) => (
            <Input
              {...aria}
              inputMode="numeric"
              value={field.value ?? ""}
              onChange={(e) => {
                const d = e.target.value.replace(/\D/g, "");
                field.onChange(d === "" ? null : Number(d));
              }}
            />
          )}
        />
      )}
    </FormField>
  );

  const details = (
    <form id="hotel-form" onSubmit={onSubmit} noValidate>
      <fieldset disabled={!canEdit || pending} className="space-y-5">
        <FormField id="h-name" label={p("name")} error={errors.name?.message}>
          {(aria) => <Input {...aria} {...form.register("name")} />}
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="h-status" label={p("status")}>
            {(aria) => (
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger {...aria} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(HOTEL_STATUS_CLASS).map((k) => (
                        <SelectItem key={k} value={k}>
                          {p(`hotelStatus.${k as keyof typeof HOTEL_STATUS_CLASS}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
          <FormField id="h-price" label={t("pricePerNight")} error={errors.pricePerNight?.message}>
            {(aria) => (
              <Controller
                control={form.control}
                name="pricePerNight"
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
          <FormField
            id="h-distance"
            label={t("distance")}
            hint={t("distanceHint")}
            error={errors.distance?.message}
          >
            {(aria) => <Input {...aria} {...form.register("distance")} />}
          </FormField>
          <FormField id="h-address" label={p("address")} error={errors.address?.message}>
            {(aria) => <Input {...aria} {...form.register("address")} />}
          </FormField>
          <FormField id="h-web" label={p("website")} error={errors.website?.message}>
            {(aria) => (
              <Input {...aria} type="url" placeholder="https://" {...form.register("website")} />
            )}
          </FormField>
          <FormField id="h-book" label={t("bookingUrl")} error={errors.bookingUrl?.message}>
            {(aria) => (
              <Input {...aria} type="url" placeholder="https://" {...form.register("bookingUrl")} />
            )}
          </FormField>
        </div>
        <fieldset className="space-y-4 rounded-lg border p-4">
          <legend className="px-1 text-sm font-medium">{t("roomBlock")}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {numberField("roomsHeld", t("roomsHeld"))}
            {numberField("roomsBooked", t("roomsBooked"))}
            <FormField id="h-code" label={t("discount")} error={errors.discountCode?.message}>
              {(aria) => <Input {...aria} {...form.register("discountCode")} />}
            </FormField>
            <FormField
              id="h-cutoff"
              label={t("cutoffDate")}
              hint={t("cutoffHint")}
              error={errors.cutoffDate?.message}
            >
              {(aria) => <Input {...aria} type="date" {...form.register("cutoffDate")} />}
            </FormField>
          </div>
        </fieldset>
        <Label className="justify-between font-normal">
          {t("showOnWebsite")}
          <Controller
            control={form.control}
            name="showOnWebsite"
            render={({ field }) => (
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
        </Label>
        <Label className="justify-between font-normal">
          {t("forCouple")}
          <Controller
            control={form.control}
            name="forCouple"
            render={({ field }) => (
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
        </Label>
        <FormField id="h-notes" label={p("notes")} error={errors.notes?.message}>
          {(aria) => <Textarea {...aria} rows={3} {...form.register("notes")} />}
        </FormField>
      </fieldset>
    </form>
  );

  return (
    <>
      <SheetHeader className="border-b px-6 py-4">
        <SheetTitle className="font-serif text-3xl">
          {hotel ? hotel.name : t("addTitle")}
        </SheetTitle>
        <SheetDescription>
          {hotel ? p(`hotelStatus.${hotel.status}`) : p("onlyName")}
        </SheetDescription>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {hotel ? (
          <Tabs defaultValue="details">
            <TabsList className="mb-4">
              <TabsTrigger value="details">{p("details")}</TabsTrigger>
              <TabsTrigger value="guests">
                {t("guestsTab", { count: stays.filter((s) => s.hotel_id === hotel.id).length })}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="details">{details}</TabsContent>
            <TabsContent value="guests">
              <HotelGuests hotelId={hotel.id} stays={stays} guests={guests} canEdit={canEdit} />
            </TabsContent>
          </Tabs>
        ) : (
          details
        )}
      </div>
      {canEdit && (
        <SheetFooter className="flex-row flex-wrap items-center gap-2 border-t px-6 py-4">
          {hotel && (
            <ConfirmDialog
              trigger={
                <Button variant="ghost" className="text-destructive me-auto" disabled={pending}>
                  <Trash2 aria-hidden /> {p("delete")}
                </Button>
              }
              title={t("deleteTitle", { name: hotel.name })}
              description={t("deleteText")}
              onConfirm={async () => {
                const r = await deleteHotel(hotel.id);
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
              {p("close")}
            </Button>
            <Button type="submit" form="hotel-form" disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              {hotel ? t("saveDetails") : t("add")}
            </Button>
          </div>
        </SheetFooter>
      )}
    </>
  );
}

/** Pick who stays here, then (optionally) their room and dates. */
function HotelGuests({
  hotelId,
  stays,
  guests,
  canEdit,
}: {
  hotelId: string;
  stays: Stay[];
  guests: PickerGuest[];
  canEdit: boolean;
}) {
  const t = useTranslations("hotels");
  const initial = stays.filter((s) => s.hotel_id === hotelId);
  const [ids, setIds] = useState(initial.map((s) => s.guest_id));
  const [details, setDetails] = useState<
    Record<string, { room: string; checkIn: string; checkOut: string }>
  >(() =>
    Object.fromEntries(
      initial.map((s) => [
        s.guest_id,
        { room: s.room ?? "", checkIn: s.check_in ?? "", checkOut: s.check_out ?? "" },
      ]),
    ),
  );
  const [pending, startTransition] = useTransition();
  const name = new Map(guests.map((g) => [g.id, g.name]));
  const d = (id: string) => details[id] ?? { room: "", checkIn: "", checkOut: "" };
  const set = (id: string, patch: Partial<ReturnType<typeof d>>) =>
    setDetails((all) => ({ ...all, [id]: { ...d(id), ...patch } }));

  return (
    <div className="space-y-4">
      {canEdit && (
        <GuestPicker guests={guests} selected={ids} onChange={setIds} maxHeight="14rem" />
      )}
      {ids.length > 0 && (
        <ul className="space-y-2">
          {ids.map((id) => (
            <li
              key={id}
              className="grid grid-cols-2 gap-2 rounded-lg border p-2 sm:grid-cols-[1fr_5rem_8.5rem_8.5rem]"
            >
              <span className="col-span-2 self-center truncate text-sm font-medium sm:col-span-1">
                {name.get(id)}
              </span>
              <Input
                className="h-8"
                placeholder={t("roomPlaceholder")}
                aria-label={t("roomFor", { name: name.get(id) ?? "" })}
                value={d(id).room}
                disabled={!canEdit}
                onChange={(e) => set(id, { room: e.target.value })}
              />
              <Input
                className="h-8"
                type="date"
                aria-label={t("checkIn", { name: name.get(id) ?? "" })}
                value={d(id).checkIn}
                disabled={!canEdit}
                onChange={(e) => set(id, { checkIn: e.target.value })}
              />
              <Input
                className="h-8"
                type="date"
                aria-label={t("checkOut", { name: name.get(id) ?? "" })}
                value={d(id).checkOut}
                disabled={!canEdit}
                onChange={(e) => set(id, { checkOut: e.target.value })}
              />
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <Button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await setHotelGuests(
                hotelId,
                ids.map((guestId) => ({ guestId, ...d(guestId) })),
              );
              if (r.ok) toast.success(t("guestsSaved"));
              else toast.error(r.error);
            })
          }
        >
          {pending && <Loader2 className="animate-spin" aria-hidden />} {t("saveGuests")}
        </Button>
      )}
    </div>
  );
}
