"use client";

import {
  BedDouble,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  MapPin,
  MessageCircle,
  Plane,
  Shirt,
  Utensils,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { fmtDate, fmtTime } from "@/lib/i18n/format";
import type { RsvpData } from "@/lib/rsvp/types";
import { googleCalendarUrl } from "@/lib/trip/calendar";
import { whatsappShareUrl } from "@/lib/trip/whatsapp";
import { TripChecklist } from "./trip-checklist";
import { YourTime } from "@/components/website/your-time";

type Props = {
  data: RsvpData;
  siteUrl: string;
};

function calendarDownloadUrl(event: RsvpData["events"][number], tz: string | null): string {
  const params = new URLSearchParams();
  params.set("title", event.name);
  if (event.event_date) params.set("date", event.event_date);
  if (event.start_time) params.set("start", event.start_time);
  if (event.end_time) params.set("end", event.end_time);
  if (tz) params.set("tz", tz);
  if (event.venue_name) params.set("location", event.venue_name + (event.address ? `, ${event.address}` : ""));
  return `/api/calendar?${params.toString()}`;
}

export function TripPage({ data, siteUrl }: Props) {
  const t = useTranslations("rsvp.trip");
  const locale = useLocale();
  const w = data.wedding;
  const tz = w.time_zone;
  const couple = `${w.partner_a_name} & ${w.partner_b_name}`;
  const rsvpLink = `${siteUrl}/r/${data.household.code}`;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="font-serif text-3xl">{t("title")}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t("subtitle", { couple })}</p>
      </div>

      {/* Events */}
      {data.events.length > 0 && (
        <section className="bg-card space-y-4 rounded-2xl border p-5 shadow-sm sm:p-7">
          <h3 className="flex items-center gap-2 text-xl font-medium">
            <Calendar className="size-5" aria-hidden />
            {t("events")}
          </h3>
          <ul className="space-y-4">
            {data.events.map((event) => (
              <li key={event.id} className="rounded-xl border p-4">
                <p className="font-medium">{event.name}</p>
                {event.event_date && (
                  <p className="text-muted-foreground mt-1 text-sm">
                    <Clock className="mr-1 inline size-3.5" aria-hidden />
                    {fmtDate(event.event_date, locale, "full")}
                    {event.start_time && ` · ${fmtTime(event.start_time, locale)}`}
                    {event.end_time && `–${fmtTime(event.end_time, locale)}`}
                  </p>
                )}
                {event.event_date && event.start_time && tz && (
                  <YourTime date={event.event_date} time={event.start_time} timeZone={tz} />
                )}
                {event.venue_name && (
                  <p className="text-muted-foreground mt-1 text-sm">
                    <MapPin className="mr-1 inline size-3.5" aria-hidden />
                    {event.venue_name}
                    {event.address && `, ${event.address}`}
                  </p>
                )}
                {event.dress_code && (
                  <p className="text-muted-foreground mt-1 text-sm">
                    <Shirt className="mr-1 inline size-3.5" aria-hidden />
                    {event.dress_code}
                  </p>
                )}
                {event.event_date && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm">
                      <a href={calendarDownloadUrl(event, tz)} download>
                        <Calendar className="size-3.5" aria-hidden />
                        {t("downloadIcs")}
                      </a>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <a
                        href={googleCalendarUrl({
                          title: event.name,
                          date: event.event_date,
                          startTime: event.start_time,
                          endTime: event.end_time,
                          timeZone: tz,
                          location: event.venue_name
                            ? event.venue_name + (event.address ? `, ${event.address}` : "")
                            : null,
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="size-3.5" aria-hidden />
                        Google Calendar
                      </a>
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Travel */}
      {data.travel && (data.travel.arrival_date || data.travel.departure_date) && (
        <section className="bg-card space-y-3 rounded-2xl border p-5 shadow-sm sm:p-7">
          <h3 className="flex items-center gap-2 text-xl font-medium">
            <Plane className="size-5" aria-hidden />
            {t("flights")}
          </h3>
          {data.travel.arrival_date && (
            <div className="rounded-xl border p-4">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                {t("arrival")}
              </p>
              <p className="mt-1 font-medium">
                {fmtDate(data.travel.arrival_date, locale, "full")}
                {data.travel.arrival_time && ` · ${data.travel.arrival_time.slice(0, 5)}`}
              </p>
              {data.travel.arrival_airport && (
                <p className="text-muted-foreground text-sm">{data.travel.arrival_airport}</p>
              )}
              {data.travel.arrival_flight && (
                <p className="text-muted-foreground text-sm">
                  {t("flight")}: {data.travel.arrival_flight}
                </p>
              )}
            </div>
          )}
          {data.travel.departure_date && (
            <div className="rounded-xl border p-4">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                {t("departure")}
              </p>
              <p className="mt-1 font-medium">
                {fmtDate(data.travel.departure_date, locale, "full")}
                {data.travel.departure_time && ` · ${data.travel.departure_time.slice(0, 5)}`}
              </p>
              {data.travel.departure_airport && (
                <p className="text-muted-foreground text-sm">{data.travel.departure_airport}</p>
              )}
              {data.travel.departure_flight && (
                <p className="text-muted-foreground text-sm">
                  {t("flight")}: {data.travel.departure_flight}
                </p>
              )}
            </div>
          )}
          {data.travel.needs_transfer && (
            <p className="text-sm">
              <CheckCircle2 className="text-success mr-1 inline size-4" aria-hidden />
              {t("transferRequested")}
            </p>
          )}
        </section>
      )}

      {/* Hotel & room */}
      {(data.room_assignments ?? []).length > 0 && (
        <section className="bg-card space-y-3 rounded-2xl border p-5 shadow-sm sm:p-7">
          <h3 className="flex items-center gap-2 text-xl font-medium">
            <BedDouble className="size-5" aria-hidden />
            {t("hotel")}
          </h3>
          <ul className="space-y-3">
            {data.room_assignments!.map((a) => {
              const gName = data.guests.find((g) => g.id === a.guest_id);
              return (
                <li key={a.guest_id} className="rounded-xl border p-4">
                  <p className="font-medium">
                    {gName ? `${gName.first_name} ${gName.last_name}`.trim() : ""}
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {a.hotel_name} · {t("room", { number: a.room_number })}
                  </p>
                  {(a.check_in || a.check_out) && (
                    <p className="text-muted-foreground text-sm">
                      {a.check_in && `${t("checkIn")}: ${fmtDate(a.check_in, locale, "medium")}`}
                      {a.check_in && a.check_out && " — "}
                      {a.check_out && `${t("checkOut")}: ${fmtDate(a.check_out, locale, "medium")}`}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Seating */}
      {w.find_seat_enabled && data.seat && (
        <section className="bg-card rounded-2xl border p-5 shadow-sm sm:p-7">
          <h3 className="flex items-center gap-2 text-xl font-medium">
            <Utensils className="size-5" aria-hidden />
            {t("yourSeat")}
          </h3>
          <div className="mt-3 rounded-xl border p-4 text-center">
            <p className="text-2xl font-medium">
              {data.seat.table_label
                ? `${data.seat.table_label} (${t("table", { number: data.seat.table_number ?? "" })})`
                : t("table", { number: data.seat.table_number ?? "" })}
            </p>
            <p className="text-muted-foreground mt-1 text-sm">{data.seat.guest_name}</p>
          </div>
        </section>
      )}

      {/* Entry checklist */}
      <TripChecklist data={data} />

      {/* WhatsApp share */}
      <section className="bg-card rounded-2xl border p-5 shadow-sm sm:p-7">
        <h3 className="flex items-center gap-2 text-xl font-medium">
          <MessageCircle className="size-5" aria-hidden />
          {t("share")}
        </h3>
        <p className="text-muted-foreground mt-1 text-sm">{t("shareDesc")}</p>
        <div className="mt-3">
          <Button asChild variant="outline">
            <a
              href={whatsappShareUrl(
                t("whatsappText", { couple, link: rsvpLink }),
              )}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle className="size-4" aria-hidden />
              {t("shareWhatsApp")}
            </a>
          </Button>
        </div>
      </section>
    </div>
  );
}
