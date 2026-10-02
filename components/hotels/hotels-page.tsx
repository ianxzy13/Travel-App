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
  LayoutGrid,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { deleteHotel, saveHotel, setHotelGuests } from "@/app/app/hotels/actions";
import {
  deleteRoom,
  deleteRoomType,
  generateRooms,
  saveRoom,
  saveRoomType,
} from "@/app/app/hotels/room-actions";
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
import type {
  HotelGuestRow,
  HotelRoomAssignmentRow,
  HotelRoomRow,
  HotelRoomTypeRow,
  HotelRow,
} from "@/lib/database.types";
import { formatMoney } from "@/lib/budget/money";
import { fmtDate } from "@/lib/i18n/format";
import { HOTEL_STATUS_CLASS } from "@/lib/places/labels";
import { roomBlockState } from "@/lib/places/travel";
import { cn } from "@/lib/utils";
import { bookingSearch } from "@/lib/vendors/search-links";
import {
  hotelSchema,
  roomSchema,
  roomTypeSchema,
  type HotelValues,
  type RoomTypeValues,
  type RoomValues,
} from "@/lib/validation/places";

export type HotelItem = Omit<HotelRow, "price_per_night"> & { price_per_night: number | null };
export type RoomTypeItem = Omit<HotelRoomTypeRow, "price_per_night"> & {
  price_per_night: number | null;
};
type Stay = Pick<HotelGuestRow, "hotel_id" | "guest_id" | "room" | "check_in" | "check_out">;

type Props = {
  hotels: HotelItem[];
  stays: Stay[];
  guests: (PickerGuest & { attending: boolean })[];
  roomTypes: RoomTypeItem[];
  rooms: HotelRoomRow[];
  roomAssignments: HotelRoomAssignmentRow[];
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

export function HotelsPage({
  hotels,
  stays,
  guests,
  roomTypes,
  rooms,
  roomAssignments,
  currency,
  location,
  canEdit,
  today,
}: Props) {
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
            {rooms.length > 0 && (
              <Button asChild variant="outline" size="sm">
                <Link href="/app/hotels/rooms">
                  <LayoutGrid aria-hidden /> {t("board.title")}
                </Link>
              </Button>
            )}
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
              roomTypes={current ? roomTypes.filter((rt) => rt.hotel_id === current.id) : []}
              rooms={current ? rooms.filter((r) => r.hotel_id === current.id) : []}
              roomAssignments={roomAssignments}
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
  roomTypes,
  rooms,
  roomAssignments,
  currency,
  canEdit,
  onClose,
  onCreated,
}: {
  hotel: HotelItem | null;
  stays: Stay[];
  guests: PickerGuest[];
  roomTypes: RoomTypeItem[];
  rooms: HotelRoomRow[];
  roomAssignments: HotelRoomAssignmentRow[];
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
              <TabsTrigger value="rooms">
                {t("roomsTab", { count: rooms.length })}
              </TabsTrigger>
              <TabsTrigger value="guests">
                {t("guestsTab", { count: stays.filter((s) => s.hotel_id === hotel.id).length })}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="details">{details}</TabsContent>
            <TabsContent value="rooms">
              <HotelRooms
                hotelId={hotel.id}
                roomTypes={roomTypes}
                rooms={rooms}
                roomAssignments={roomAssignments}
                currency={currency}
                canEdit={canEdit}
              />
            </TabsContent>
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

const BED_ICONS: Record<string, string> = {
  double: "🛏️",
  single: "🛏️",
  sofa_bed: "🛋️",
  bunk: "🪜",
};

function useBedLabels() {
  const t = useTranslations("hotels");
  return {
    double: t("rooms.bed.double"),
    single: t("rooms.bed.single"),
    sofa_bed: t("rooms.bed.sofa_bed"),
    bunk: t("rooms.bed.bunk"),
  } as Record<string, string>;
}

function HotelRooms({
  hotelId,
  roomTypes,
  rooms,
  roomAssignments,
  currency,
  canEdit,
}: {
  hotelId: string;
  roomTypes: RoomTypeItem[];
  rooms: HotelRoomRow[];
  roomAssignments: HotelRoomAssignmentRow[];
  currency: string;
  canEdit: boolean;
}) {
  const t = useTranslations("hotels");
  const [pending, startTransition] = useTransition();
  const [editingType, setEditingType] = useState<string | "new" | null>(null);
  const [editingRoom, setEditingRoom] = useState<string | "new" | null>(null);
  const [forTypeId, setForTypeId] = useState<string | null>(null);
  const bedLabels = useBedLabels();

  const editType = editingType && editingType !== "new"
    ? roomTypes.find((rt) => rt.id === editingType) ?? null
    : null;
  const editRoom = editingRoom && editingRoom !== "new"
    ? rooms.find((r) => r.id === editingRoom) ?? null
    : null;

  return (
    <div className="space-y-6">
      {/* Room types section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">{t("rooms.types")}</h3>
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditingType("new")}
            >
              <Plus aria-hidden /> {t("rooms.addType")}
            </Button>
          )}
        </div>
        {roomTypes.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("rooms.noTypes")}</p>
        ) : (
          <ul className="space-y-2">
            {roomTypes.map((rt) => {
              const roomCount = rooms.filter((r) => r.room_type_id === rt.id).length;
              return (
                <li
                  key={rt.id}
                  className="bg-muted/50 flex items-center justify-between gap-2 rounded-lg border p-3"
                >
                  <button
                    type="button"
                    className="flex-1 text-start"
                    onClick={() => setEditingType(rt.id)}
                  >
                    <p className="text-sm font-medium">{rt.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {(rt.beds as { kind: string; count: number }[]).map(
                        (b, i) =>
                          `${b.count}× ${BED_ICONS[b.kind] ?? ""} ${bedLabels[b.kind] ?? b.kind}${i < rt.beds.length - 1 ? ", " : ""}`,
                      )}
                      {rt.has_crib && ` + ${t("rooms.crib")}`}
                      {" · "}
                      {t("rooms.maxGuests", { count: rt.max_guests })}
                      {rt.price_per_night != null &&
                        ` · ${formatMoney(rt.price_per_night, currency)}/${t("rooms.night")}`}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {t("rooms.ofType", { created: roomCount, total: rt.count })}
                    </p>
                  </button>
                  {rt.accessible && (
                    <span className="text-xs" title={t("rooms.accessible")}>♿</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {canEdit && roomTypes.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await generateRooms(hotelId);
                if (r.ok) toast.success(t("rooms.generated"));
                else toast.error(r.error);
              })
            }
          >
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {t("rooms.generate")}
          </Button>
        )}
      </section>

      {/* Individual rooms section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">
            {t("rooms.list", { count: rooms.length })}
          </h3>
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setForTypeId(null);
                setEditingRoom("new");
              }}
            >
              <Plus aria-hidden /> {t("rooms.addRoom")}
            </Button>
          )}
        </div>
        {rooms.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("rooms.noRooms")}</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-2">
            {rooms.map((room) => {
              const assigned = roomAssignments.filter((a) => a.room_id === room.id).length;
              const rt = roomTypes.find((t) => t.id === room.room_type_id);
              return (
                <button
                  key={room.id}
                  type="button"
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-lg border p-2 text-start text-xs transition-colors",
                    room.is_locked
                      ? "border-amber-500/30 bg-amber-50 dark:bg-amber-950/20"
                      : "hover:bg-muted/50",
                  )}
                  onClick={() => setEditingRoom(room.id)}
                >
                  <span className="font-mono font-medium">{room.room_number}</span>
                  <span className="text-muted-foreground truncate">
                    {rt?.name ?? t("rooms.untyped")}
                  </span>
                  <span className="text-muted-foreground">
                    {assigned}/{rt?.max_guests ?? "?"} {t("rooms.guests")}
                  </span>
                  {room.is_locked && <span title={t("rooms.locked")}>🔒</span>}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Room type edit dialog */}
      {editingType && (
        <RoomTypeForm
          hotelId={hotelId}
          roomType={editType}
          currency={currency}
          canEdit={canEdit}
          onClose={() => setEditingType(null)}
        />
      )}

      {/* Room edit dialog */}
      {editingRoom && (
        <RoomForm
          hotelId={hotelId}
          room={editRoom}
          roomTypes={roomTypes}
          defaultTypeId={forTypeId}
          canEdit={canEdit}
          onClose={() => setEditingRoom(null)}
        />
      )}
    </div>
  );
}

function RoomTypeForm({
  hotelId,
  roomType,
  currency,
  canEdit,
  onClose,
}: {
  hotelId: string;
  roomType: RoomTypeItem | null;
  currency: string;
  canEdit: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("hotels");
  const p = useTranslations("places");
  const bedLabels = useBedLabels();
  const [pending, startTransition] = useTransition();
  const form = useForm({
    resolver: zodResolver(roomTypeSchema),
    defaultValues: {
      name: roomType?.name ?? "",
      beds: (roomType?.beds ?? [{ kind: "double", count: 1 }]) as { kind: "double" | "single" | "sofa_bed" | "bunk"; count: number }[],
      maxGuests: roomType?.max_guests ?? 2,
      hasCrib: roomType?.has_crib ?? false,
      accessible: roomType?.accessible ?? false,
      pricePerNight: roomType?.price_per_night ?? null,
      count: roomType?.count ?? 1,
      notes: roomType?.notes ?? "",
    } satisfies RoomTypeValues,
  });
  const { errors } = form.formState;
  const beds = form.watch("beds");

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const r = await saveRoomType(hotelId, values, roomType?.id);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(roomType ? t("saved") : t("added"));
      onClose();
    }),
  );

  return (
    <div className="bg-card fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-card mx-4 max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl border p-6 shadow-lg">
        <h3 className="mb-4 font-serif text-xl">
          {roomType ? t("rooms.editType") : t("rooms.addType")}
        </h3>
        <form onSubmit={onSubmit} noValidate>
          <fieldset disabled={!canEdit || pending} className="space-y-4">
            <FormField id="rt-name" label={p("name")} error={errors.name?.message}>
              {(aria) => <Input {...aria} {...form.register("name")} />}
            </FormField>

            <div>
              <Label className="mb-2 block text-sm">{t("rooms.beds")}</Label>
              {beds.map((bed, i) => (
                <div key={i} className="mb-2 flex items-center gap-2">
                  <Controller
                    control={form.control}
                    name={`beds.${i}.kind`}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(["double", "single", "sofa_bed", "bunk"] as const).map((k) => (
                            <SelectItem key={k} value={k}>
                              {BED_ICONS[k]} {bedLabels[k] ?? k}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <Controller
                    control={form.control}
                    name={`beds.${i}.count`}
                    render={({ field }) => (
                      <Input
                        className="w-16"
                        type="number"
                        min={1}
                        max={10}
                        value={field.value}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="size-8 p-0"
                    onClick={() => {
                      const next = [...beds];
                      next.splice(i, 1);
                      form.setValue("beds", next.length ? next : [{ kind: "double", count: 1 }]);
                    }}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </Button>
                </div>
              ))}
              {beds.length < 10 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => form.setValue("beds", [...beds, { kind: "single", count: 1 }])}
                >
                  <Plus className="size-3.5" aria-hidden /> {t("rooms.addBed")}
                </Button>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="rt-max" label={t("rooms.maxGuests", { count: 0 }).replace("0 ", "")} error={errors.maxGuests?.message}>
                {(aria) => (
                  <Input
                    {...aria}
                    type="number"
                    min={1}
                    max={20}
                    {...form.register("maxGuests", { valueAsNumber: true })}
                  />
                )}
              </FormField>
              <FormField id="rt-count" label={t("rooms.typeCount")} error={errors.count?.message}>
                {(aria) => (
                  <Input
                    {...aria}
                    type="number"
                    min={0}
                    max={500}
                    {...form.register("count", { valueAsNumber: true })}
                  />
                )}
              </FormField>
            </div>

            <FormField id="rt-price" label={t("pricePerNight")} error={errors.pricePerNight?.message}>
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

            <Label className="justify-between font-normal">
              {t("rooms.hasCrib")}
              <Controller
                control={form.control}
                name="hasCrib"
                render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
            </Label>

            <Label className="justify-between font-normal">
              {t("rooms.accessible")}
              <Controller
                control={form.control}
                name="accessible"
                render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
            </Label>

            <FormField id="rt-notes" label={p("notes")} error={errors.notes?.message}>
              {(aria) => <Textarea {...aria} rows={2} {...form.register("notes")} />}
            </FormField>
          </fieldset>

          <div className="mt-6 flex justify-between gap-2">
            {roomType && canEdit && (
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" className="text-destructive" disabled={pending}>
                    <Trash2 aria-hidden /> {p("delete")}
                  </Button>
                }
                title={t("rooms.deleteType")}
                description={t("rooms.deleteTypeText")}
                onConfirm={async () => {
                  const r = await deleteRoomType(roomType.id);
                  if (!r.ok) {
                    toast.error(r.error);
                    return false;
                  }
                  onClose();
                }}
              />
            )}
            <div className="ms-auto flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                {p("cancel")}
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" aria-hidden />}
                {p("save")}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function RoomForm({
  hotelId,
  room,
  roomTypes,
  defaultTypeId,
  canEdit,
  onClose,
}: {
  hotelId: string;
  room: HotelRoomRow | null;
  roomTypes: RoomTypeItem[];
  defaultTypeId: string | null;
  canEdit: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("hotels");
  const p = useTranslations("places");
  const [pending, startTransition] = useTransition();
  const form = useForm({
    resolver: zodResolver(roomSchema),
    defaultValues: {
      roomNumber: room?.room_number ?? "",
      roomTypeId: room?.room_type_id ?? defaultTypeId ?? "",
      floor: room?.floor ?? "",
      isLocked: room?.is_locked ?? false,
      notes: room?.notes ?? "",
    } satisfies RoomValues,
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const r = await saveRoom(hotelId, values, room?.id);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(room ? t("saved") : t("added"));
      onClose();
    }),
  );

  return (
    <div className="bg-card fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-card mx-4 max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-xl border p-6 shadow-lg">
        <h3 className="mb-4 font-serif text-xl">
          {room ? t("rooms.editRoom") : t("rooms.addRoom")}
        </h3>
        <form onSubmit={onSubmit} noValidate>
          <fieldset disabled={!canEdit || pending} className="space-y-4">
            <FormField id="rm-num" label={t("rooms.number")} error={errors.roomNumber?.message}>
              {(aria) => <Input {...aria} {...form.register("roomNumber")} />}
            </FormField>
            <FormField id="rm-type" label={t("rooms.type")}>
              {(aria) => (
                <Controller
                  control={form.control}
                  name="roomTypeId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger {...aria} className="w-full">
                        <SelectValue placeholder={t("rooms.selectType")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">{t("rooms.noType")}</SelectItem>
                        {roomTypes.map((rt) => (
                          <SelectItem key={rt.id} value={rt.id}>
                            {rt.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </FormField>
            <FormField id="rm-floor" label={t("rooms.floor")} error={errors.floor?.message}>
              {(aria) => <Input {...aria} {...form.register("floor")} />}
            </FormField>
            <Label className="justify-between font-normal">
              {t("rooms.locked")}
              <Controller
                control={form.control}
                name="isLocked"
                render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
            </Label>
            <FormField id="rm-notes" label={p("notes")} error={errors.notes?.message}>
              {(aria) => <Textarea {...aria} rows={2} {...form.register("notes")} />}
            </FormField>
          </fieldset>
          <div className="mt-6 flex justify-between gap-2">
            {room && canEdit && (
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" className="text-destructive" disabled={pending}>
                    <Trash2 aria-hidden /> {p("delete")}
                  </Button>
                }
                title={t("rooms.deleteRoom")}
                description={t("rooms.deleteRoomText")}
                onConfirm={async () => {
                  const r = await deleteRoom(room.id);
                  if (!r.ok) {
                    toast.error(r.error);
                    return false;
                  }
                  onClose();
                }}
              />
            )}
            <div className="ms-auto flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                {p("cancel")}
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" aria-hidden />}
                {p("save")}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
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
