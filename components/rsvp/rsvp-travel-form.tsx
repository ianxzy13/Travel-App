"use client";

import { useState, useTransition } from "react";
import { BedDouble, Loader2, Plane, PlaneLanding, PlaneTakeoff } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { submitGuestTravel, submitRoomPreferences } from "@/app/r/actions";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { RsvpData } from "@/lib/rsvp/types";
import type { GuestTravelPayload } from "@/lib/validation/rsvp";

type Props = {
  data: RsvpData;
  onSaved: () => void;
  onSkip: () => void;
};

export function RsvpTravelForm({ data, onSaved, onSkip }: Props) {
  const t = useTranslations("rsvp.travel");
  const te = useTranslations("rsvp.errors");
  const [busy, startTransition] = useTransition();

  const tr = useTranslations("rsvp.room");

  type RoomPref = {
    guest_id: string;
    wants_hotel_room: "yes" | "no" | "elsewhere" | null;
    needs_crib: boolean;
    room_pref_share: string | null;
    room_pref_avoid: string | null;
  };

  const [roomPrefs, setRoomPrefs] = useState<RoomPref[]>(() =>
    data.guests.map((g) => ({
      guest_id: g.id,
      wants_hotel_room: g.wants_hotel_room,
      needs_crib: g.needs_crib,
      room_pref_share: g.room_pref_share,
      room_pref_avoid: g.room_pref_avoid,
    })),
  );

  const setRoomPref = (guestId: string, patch: Partial<RoomPref>) =>
    setRoomPrefs((prev) =>
      prev.map((p) => (p.guest_id === guestId ? { ...p, ...patch } : p)),
    );

  const hasHotels = (data.hotels ?? []).length > 0;
  const askTravel = data.wedding.rsvp_ask_travel;

  const travel = data.travel;
  const [form, setForm] = useState<GuestTravelPayload>({
    arrival_date: travel?.arrival_date ?? "",
    arrival_time: travel?.arrival_time?.slice(0, 5) ?? "",
    arrival_airport: travel?.arrival_airport ?? "",
    arrival_flight: travel?.arrival_flight ?? "",
    departure_date: travel?.departure_date ?? "",
    departure_time: travel?.departure_time?.slice(0, 5) ?? "",
    departure_airport: travel?.departure_airport ?? "",
    departure_flight: travel?.departure_flight ?? "",
    staying_at: travel?.staying_at ?? "",
    hotel_id: travel?.hotel_id ?? "",
    needs_transfer: travel?.needs_transfer ?? false,
    transport_notes: travel?.transport_notes ?? "",
  });

  const set = <K extends keyof GuestTravelPayload>(key: K, value: GuestTravelPayload[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const [travelResult, roomResult] = await Promise.all([
        // travel questions are only on when the couple switched them on;
        // the room questions show whenever there are hotels
        askTravel
          ? submitGuestTravel(data.household.code, form)
          : Promise.resolve({ ok: true } as const),
        hasHotels
          ? submitRoomPreferences(data.household.code, roomPrefs)
          : Promise.resolve({ ok: true } as const),
      ]);
      if (!travelResult.ok) {
        toast.error("error" in travelResult ? travelResult.error : te("generic"));
        return;
      }
      if (!roomResult.ok) {
        toast.error("error" in roomResult ? roomResult.error : te("generic"));
        return;
      }
      toast.success(t("saved"));
      onSaved();
    });
  }

  const hotels = data.hotels ?? [];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {askTravel && (
      <div className="bg-card rounded-2xl border p-5 shadow-sm sm:p-7">
        <div className="flex items-center gap-3">
          <Plane className="text-primary-ink size-6 shrink-0" aria-hidden />
          <h2 className="text-2xl">{t("title")}</h2>
        </div>
        <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>

        {/* Arrival */}
        <fieldset className="mt-6 space-y-3">
          <legend className="flex items-center gap-2 font-medium">
            <PlaneLanding className="size-4" aria-hidden />
            {t("arrival")}
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="arr-date">{t("date")}</Label>
              <Input
                id="arr-date"
                type="date"
                value={form.arrival_date ?? ""}
                onChange={(e) => set("arrival_date", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="arr-time">{t("time")}</Label>
              <Input
                id="arr-time"
                type="time"
                value={form.arrival_time ?? ""}
                onChange={(e) => set("arrival_time", e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="arr-airport">{t("airport")}</Label>
              <Input
                id="arr-airport"
                placeholder={t("airportPlaceholder")}
                maxLength={10}
                value={form.arrival_airport ?? ""}
                onChange={(e) => set("arrival_airport", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="arr-flight">{t("flightNumber")}</Label>
              <Input
                id="arr-flight"
                placeholder="e.g. BA 1234"
                maxLength={20}
                value={form.arrival_flight ?? ""}
                onChange={(e) => set("arrival_flight", e.target.value)}
              />
            </div>
          </div>
        </fieldset>

        {/* Departure */}
        <fieldset className="mt-6 space-y-3">
          <legend className="flex items-center gap-2 font-medium">
            <PlaneTakeoff className="size-4" aria-hidden />
            {t("departure")}
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="dep-date">{t("date")}</Label>
              <Input
                id="dep-date"
                type="date"
                value={form.departure_date ?? ""}
                onChange={(e) => set("departure_date", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="dep-time">{t("time")}</Label>
              <Input
                id="dep-time"
                type="time"
                value={form.departure_time ?? ""}
                onChange={(e) => set("departure_time", e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="dep-airport">{t("airport")}</Label>
              <Input
                id="dep-airport"
                placeholder={t("airportPlaceholder")}
                maxLength={10}
                value={form.departure_airport ?? ""}
                onChange={(e) => set("departure_airport", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="dep-flight">{t("flightNumber")}</Label>
              <Input
                id="dep-flight"
                placeholder="e.g. BA 1235"
                maxLength={20}
                value={form.departure_flight ?? ""}
                onChange={(e) => set("departure_flight", e.target.value)}
              />
            </div>
          </div>
        </fieldset>

        {/* Accommodation */}
        {hotels.length > 0 && (
          <div className="mt-6 space-y-3">
            <Label htmlFor="hotel">{t("stayingAt")}</Label>
            <Select
              value={form.hotel_id ?? ""}
              onValueChange={(v) => {
                set("hotel_id", v === "_other" ? "" : v);
                set("staying_at", v === "_other" ? "" : "");
              }}
            >
              <SelectTrigger id="hotel">
                <SelectValue placeholder={t("chooseHotel")} />
              </SelectTrigger>
              <SelectContent>
                {hotels.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.name}
                  </SelectItem>
                ))}
                <SelectItem value="_other">{t("otherAccommodation")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {(!form.hotel_id || hotels.length === 0) && (
          <div className="mt-3">
            <Label htmlFor="staying">{t("accommodationName")}</Label>
            <Input
              id="staying"
              placeholder={t("accommodationPlaceholder")}
              maxLength={200}
              value={form.staying_at ?? ""}
              onChange={(e) => set("staying_at", e.target.value)}
            />
          </div>
        )}

        {/* Transfer */}
        <div className="mt-6 flex items-center gap-3">
          <Switch
            id="transfer"
            checked={form.needs_transfer ?? false}
            onCheckedChange={(v) => set("needs_transfer", v)}
          />
          <Label htmlFor="transfer" className="cursor-pointer">
            {t("needsTransfer")}
          </Label>
        </div>

        {/* Notes */}
        <div className="mt-4">
          <Label htmlFor="notes">{t("notes")}</Label>
          <Textarea
            id="notes"
            placeholder={t("notesPlaceholder")}
            maxLength={500}
            rows={2}
            value={form.transport_notes ?? ""}
            onChange={(e) => set("transport_notes", e.target.value)}
          />
        </div>
      </div>
      )}

      {/* Room preferences */}
      {hasHotels && (
        <div className="bg-card rounded-2xl border p-5 shadow-sm sm:p-7">
          <div className="flex items-center gap-3">
            <BedDouble className="text-primary-ink size-6 shrink-0" aria-hidden />
            <h2 className="text-2xl">{tr("title")}</h2>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">{tr("subtitle")}</p>

          <div className="mt-5 space-y-6">
            {data.guests.map((guest) => {
              const pref = roomPrefs.find((p) => p.guest_id === guest.id);
              if (!pref) return null;
              const guestName = `${guest.first_name} ${guest.last_name}`.trim();
              return (
                <div key={guest.id} className="space-y-3 border-t pt-4 first:border-0 first:pt-0">
                  <p className="font-medium">{guestName}</p>
                  <div>
                    <Label>{tr("wantRoom")}</Label>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {(["yes", "no", "elsewhere"] as const).map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setRoomPref(guest.id, { wants_hotel_room: opt })}
                          className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                            pref.wants_hotel_room === opt
                              ? "border-primary bg-primary text-primary-foreground font-medium"
                              : "bg-background hover:bg-accent"
                          }`}
                        >
                          {tr(`option.${opt}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                  {pref.wants_hotel_room === "yes" && (
                    <>
                      {(guest.age_group === "child" || guest.age_group === "infant") && (
                        <div className="flex items-center gap-3">
                          <Switch
                            id={`crib-${guest.id}`}
                            checked={pref.needs_crib}
                            onCheckedChange={(v) => setRoomPref(guest.id, { needs_crib: v })}
                          />
                          <Label htmlFor={`crib-${guest.id}`} className="cursor-pointer">
                            {tr("needsCrib")}
                          </Label>
                        </div>
                      )}
                      <div>
                        <Label htmlFor={`share-${guest.id}`}>{tr("share")}</Label>
                        <Input
                          id={`share-${guest.id}`}
                          placeholder={tr("sharePlaceholder")}
                          maxLength={200}
                          value={pref.room_pref_share ?? ""}
                          onChange={(e) =>
                            setRoomPref(guest.id, { room_pref_share: e.target.value || null })
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor={`avoid-${guest.id}`}>{tr("avoid")}</Label>
                        <Input
                          id={`avoid-${guest.id}`}
                          placeholder={tr("avoidPlaceholder")}
                          maxLength={200}
                          value={pref.room_pref_avoid ?? ""}
                          onChange={(e) =>
                            setRoomPref(guest.id, { room_pref_avoid: e.target.value || null })
                          }
                        />
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <Button type="submit" size="lg" className="flex-1" disabled={busy}>
          {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
          {t("save")}
        </Button>
        <Button type="button" size="lg" variant="outline" onClick={onSkip} disabled={busy}>
          {t("skip")}
        </Button>
      </div>
    </form>
  );
}
