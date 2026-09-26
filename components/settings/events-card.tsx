"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Shirt,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  addDefaultEvents,
  deleteEvent,
  reorderEvents,
  saveEvent,
} from "@/app/app/settings/event-actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { EventRow } from "@/lib/database.types";
import { formatEventWhen } from "@/lib/format";
import { eventSchema, type EventFormValues } from "@/lib/validation/guest";

export type EventItem = EventRow & { invitedCount: number };

export type BookedVenue = { id: string; name: string; address: string | null };

export function EventsCard({
  events,
  readOnly,
  bookedVenues = [],
}: {
  events: EventItem[];
  readOnly: boolean;
  bookedVenues?: BookedVenue[];
}) {
  const [editing, setEditing] = useState<EventItem | "new" | null>(null);
  const [pending, startTransition] = useTransition();

  function move(index: number, delta: -1 | 1) {
    const ids = events.map((e) => e.id);
    [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]];
    startTransition(async () => {
      const result = await reorderEvents(ids);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <Card id="events" className="scroll-mt-20">
      <CardHeader>
        <CardTitle className="font-serif text-2xl">Events</CardTitle>
        <CardDescription>
          Welcome drinks, ceremony, reception, brunch… Each guest can be invited to some or all.
        </CardDescription>
        {!readOnly && events.length > 0 && (
          <CardAction>
            <Button size="sm" onClick={() => setEditing("new")}>
              <Plus aria-hidden /> Add event
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center">
            <CalendarDays className="text-primary size-8" aria-hidden />
            <p className="text-muted-foreground text-sm">
              No events yet. Most couples start with a ceremony and a reception.
            </p>
            {!readOnly && (
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await addDefaultEvents();
                      if (result.ok) toast.success("Ceremony and reception added");
                      else toast.error(result.error);
                    })
                  }
                >
                  {pending && <Loader2 className="animate-spin" aria-hidden />}
                  Add ceremony &amp; reception
                </Button>
                <Button variant="outline" onClick={() => setEditing("new")}>
                  Add a different event
                </Button>
              </div>
            )}
          </div>
        ) : (
          <ol className="divide-y rounded-lg border">
            {events.map((event, i) => (
              <li key={event.id} className="flex flex-wrap items-start gap-3 p-4">
                <div className="min-w-48 flex-1">
                  <p className="font-medium">{event.name}</p>
                  <div className="text-muted-foreground mt-1 space-y-0.5 text-sm">
                    <p className="flex items-center gap-1.5">
                      <CalendarDays className="size-3.5" aria-hidden />
                      {formatEventWhen(event)}
                    </p>
                    {(event.venue_name || event.address) && (
                      <p className="flex items-center gap-1.5">
                        <MapPin className="size-3.5" aria-hidden />
                        {[event.venue_name, event.address].filter(Boolean).join(", ")}
                      </p>
                    )}
                    {event.dress_code && (
                      <p className="flex items-center gap-1.5">
                        <Shirt className="size-3.5" aria-hidden />
                        {event.dress_code}
                      </p>
                    )}
                    <p>
                      {event.invitedCount} guest{event.invitedCount === 1 ? "" : "s"} invited
                    </p>
                  </div>
                </div>
                {!readOnly && (
                  <div className="ml-auto flex items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={i === 0 || pending}
                      onClick={() => move(i, -1)}
                      aria-label={`Move ${event.name} up`}
                    >
                      <ArrowUp aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={i === events.length - 1 || pending}
                      onClick={() => move(i, 1)}
                      aria-label={`Move ${event.name} down`}
                    >
                      <ArrowDown aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditing(event)}
                      aria-label={`Edit ${event.name}`}
                    >
                      <Pencil aria-hidden />
                    </Button>
                    <ConfirmDialog
                      trigger={
                        <Button variant="ghost" size="icon" aria-label={`Delete ${event.name}`}>
                          <Trash2 aria-hidden />
                        </Button>
                      }
                      title={`Delete ${event.name}?`}
                      description={`${event.invitedCount} guest invitation(s) to this event will be removed too.`}
                      onConfirm={async () => {
                        const result = await deleteEvent(event.id);
                        if (!result.ok) {
                          toast.error(result.error);
                          return false;
                        }
                        toast.success(`${event.name} deleted`);
                      }}
                    />
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </CardContent>

      <EventDialog
        // new key per event so the form resets its values
        key={editing === "new" ? "new" : (editing?.id ?? "closed")}
        event={editing}
        onClose={() => setEditing(null)}
        bookedVenues={bookedVenues}
      />
    </Card>
  );
}

function toFormValues(e: EventRow | null): EventFormValues {
  return {
    name: e?.name ?? "",
    eventDate: e?.event_date ?? "",
    startTime: e?.start_time?.slice(0, 5) ?? "",
    endTime: e?.end_time?.slice(0, 5) ?? "",
    venueName: e?.venue_name ?? "",
    address: e?.address ?? "",
    dressCode: e?.dress_code ?? "",
    description: e?.description ?? "",
  };
}

function EventDialog({
  event,
  onClose,
  bookedVenues,
}: {
  event: EventItem | "new" | null;
  onClose: () => void;
  bookedVenues: BookedVenue[];
}) {
  const existing = event && event !== "new" ? event : null;
  const [pending, startTransition] = useTransition();
  const form = useForm({
    resolver: zodResolver(eventSchema),
    defaultValues: toFormValues(existing),
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await saveEvent(values, existing?.id);
      if (result.ok) {
        toast.success(existing ? "Event updated" : "Event added");
        onClose();
      } else {
        toast.error(result.error);
      }
    }),
  );

  return (
    <Dialog open={event !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {existing ? `Edit ${existing.name}` : "Add an event"}
          </DialogTitle>
          <DialogDescription>
            These details appear on invitations and your wedding website.
          </DialogDescription>
        </DialogHeader>
        {bookedVenues.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Use a booked venue:</span>
            {bookedVenues.map((v) => (
              <Button
                key={v.id}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  form.setValue("venueName", v.name, { shouldDirty: true });
                  form.setValue("address", v.address ?? "", { shouldDirty: true });
                }}
              >
                {v.name}
              </Button>
            ))}
          </div>
        )}
        <form id="event-form" onSubmit={onSubmit} className="grid gap-4" noValidate>
          <FormField id="ev-name" label="Name" error={errors.name?.message}>
            {(aria) => (
              <Input {...aria} placeholder="e.g. Welcome drinks" {...form.register("name")} />
            )}
          </FormField>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField id="ev-date" label="Date" error={errors.eventDate?.message}>
              {(aria) => <Input {...aria} type="date" {...form.register("eventDate")} />}
            </FormField>
            <FormField id="ev-start" label="Starts" error={errors.startTime?.message}>
              {(aria) => <Input {...aria} type="time" {...form.register("startTime")} />}
            </FormField>
            <FormField id="ev-end" label="Ends" error={errors.endTime?.message}>
              {(aria) => <Input {...aria} type="time" {...form.register("endTime")} />}
            </FormField>
          </div>
          <FormField id="ev-venue" label="Venue" error={errors.venueName?.message}>
            {(aria) => (
              <Input
                {...aria}
                placeholder="e.g. Quinta da Regaleira"
                {...form.register("venueName")}
              />
            )}
          </FormField>
          <FormField id="ev-address" label="Address" error={errors.address?.message}>
            {(aria) => <Input {...aria} {...form.register("address")} />}
          </FormField>
          <FormField id="ev-dress" label="Dress code" error={errors.dressCode?.message}>
            {(aria) => (
              <Input
                {...aria}
                placeholder="e.g. Black tie optional"
                {...form.register("dressCode")}
              />
            )}
          </FormField>
          <FormField id="ev-desc" label="Notes for guests" error={errors.description?.message}>
            {(aria) => <Textarea {...aria} rows={3} {...form.register("description")} />}
          </FormField>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="event-form" disabled={pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {existing ? "Save changes" : "Add event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
