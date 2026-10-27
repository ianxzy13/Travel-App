"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Loader2, MapPin, Shirt, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";
import { fmtEventWhen } from "@/lib/i18n/format";
import {
  answerKey,
  findMissing,
  needsMeal,
  rsvpGuestName,
  toPayload,
  type GuestNameLabels,
  type RsvpFormState,
} from "@/lib/rsvp/form";
import type { RsvpData, RsvpResult } from "@/lib/rsvp/types";
import { cn } from "@/lib/utils";

/** "Ann's guest" / "Guest" in the current language. */
export function useGuestNameLabels(): GuestNameLabels {
  const t = useTranslations("rsvp.form");
  return { guestOf: (name) => t("guestOf", { name }), guest: t("guest") };
}

/**
 * The RSVP questions: for each event, each invited person says yes/no (and
 * picks a meal where needed), then names, dietary notes, song and message.
 * Used on the public page and by the couple ("record a reply").
 */
export function RsvpForm({
  data,
  state,
  onStateChange,
  onSubmit,
  onSaved,
  submitLabel,
}: {
  data: RsvpData;
  state: RsvpFormState;
  onStateChange: (s: RsvpFormState) => void;
  onSubmit: (payload: ReturnType<typeof toPayload>) => Promise<ActionResult<RsvpResult>>;
  onSaved: (result: RsvpResult) => void;
  submitLabel?: string;
}) {
  const t = useTranslations("rsvp");
  const tf = useTranslations("rsvp.form");
  const locale = useLocale();
  const labels = useGuestNameLabels();
  const name = (guestId: string, withState = true) =>
    rsvpGuestName(data, guestId, withState ? state : undefined, labels);
  const [pending, startTransition] = useTransition();
  const [showErrors, setShowErrors] = useState(false);
  const missing = findMissing(data, state);
  const missingSet = new Set(missing.map((m) => answerKey(m.guestId, m.eventId)));
  const couple = `${data.wedding.partner_a_name} & ${data.wedding.partner_b_name}`;

  const invitedTo = (eventId: string) =>
    data.invites.filter((i) => i.event_id === eventId).map((i) => i.guest_id);
  const attendingAnything = (guestId: string) =>
    data.invites.some(
      (i) =>
        i.guest_id === guestId &&
        state.answers[answerKey(guestId, i.event_id)]?.status === "attending",
    );

  function setAnswer(
    guestId: string,
    eventId: string,
    patch: Partial<RsvpFormState["answers"][string]>,
  ) {
    const key = answerKey(guestId, eventId);
    onStateChange({
      ...state,
      answers: { ...state.answers, [key]: { ...state.answers[key], ...patch } },
    });
  }

  function setEveryone(eventId: string, status: "attending" | "declined") {
    const answers = { ...state.answers };
    for (const g of invitedTo(eventId)) {
      const key = answerKey(g, eventId);
      answers[key] = { ...answers[key], status };
    }
    onStateChange({ ...state, answers });
  }

  function setPerson(guestId: string, patch: Partial<RsvpFormState["people"][string]>) {
    onStateChange({
      ...state,
      people: { ...state.people, [guestId]: { ...state.people[guestId], ...patch } },
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (missing.length > 0) {
      setShowErrors(true);
      toast.error(missing[0].kind === "meal" ? tf("missingMeal") : tf("missingAnswer"));
      document
        .getElementById(`q-${missing[0].guestId}-${missing[0].eventId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    startTransition(async () => {
      const result = await onSubmit(toPayload(data, state));
      if (result.ok) onSaved(result.data);
      else toast.error(result.error);
    });
  }

  const plusOnes = data.guests.filter((g) => g.plus_one_of);
  const peopleComing = data.guests.filter((g) => attendingAnything(g.id));

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      {data.events.map((event) => {
        const guests = invitedTo(event.id);
        const mealAsked = needsMeal(data, event.id);
        const where = [event.venue_name, event.address].filter(Boolean).join(", ");
        return (
          <section
            key={event.id}
            className="bg-card rounded-2xl border p-5 shadow-sm sm:p-7"
            aria-labelledby={`ev-${event.id}`}
          >
            <h2 id={`ev-${event.id}`} className="text-3xl">
              {event.name}
            </h2>
            <div className="text-muted-foreground mt-2 space-y-1 text-sm">
              <p>{fmtEventWhen(event, locale, t("dateTbd"))}</p>
              {where && (
                <p className="flex items-start gap-1.5">
                  <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <a
                    className="hover:text-foreground underline-offset-2 hover:underline"
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(where)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {where}
                  </a>
                </p>
              )}
              {event.dress_code && (
                <p className="flex items-center gap-1.5">
                  <Shirt className="size-4" aria-hidden /> {event.dress_code}
                </p>
              )}
              {event.description && <p className="whitespace-pre-line">{event.description}</p>}
            </div>

            {guests.length > 1 && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEveryone(event.id, "attending")}
                >
                  {tf("everyone")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setEveryone(event.id, "declined")}
                >
                  {tf("none")}
                </Button>
              </div>
            )}

            <ul className="mt-5 space-y-4">
              {guests.map((guestId) => {
                const key = answerKey(guestId, event.id);
                const answer = state.answers[key];
                const guestName = name(guestId);
                const invalid = showErrors && missingSet.has(key);
                return (
                  <li
                    key={guestId}
                    id={`q-${guestId}-${event.id}`}
                    className={cn(
                      "rounded-xl border p-4",
                      invalid && "border-destructive ring-destructive/20 ring-2",
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-medium">{guestName}</p>
                      <div
                        role="radiogroup"
                        aria-label={tf("willAttend", { name: guestName, event: event.name })}
                        className="flex gap-2"
                      >
                        <Choice
                          selected={answer?.status === "attending"}
                          onClick={() => setAnswer(guestId, event.id, { status: "attending" })}
                          icon={<Check className="size-4" aria-hidden />}
                        >
                          {tf("accept")}
                        </Choice>
                        <Choice
                          selected={answer?.status === "declined"}
                          onClick={() => setAnswer(guestId, event.id, { status: "declined" })}
                          icon={<X className="size-4" aria-hidden />}
                          muted
                        >
                          {tf("decline")}
                        </Choice>
                      </div>
                    </div>

                    {mealAsked && answer?.status === "attending" && (
                      <fieldset className="mt-4">
                        <legend className="text-muted-foreground mb-2 text-sm">{tf("meal")}</legend>
                        <div role="radiogroup" className="flex flex-wrap gap-2">
                          {data.meal_options.map((m) => (
                            <Choice
                              key={m.id}
                              selected={answer.mealOptionId === m.id}
                              onClick={() => setAnswer(guestId, event.id, { mealOptionId: m.id })}
                              title={m.description ?? undefined}
                            >
                              {m.name}
                            </Choice>
                          ))}
                        </div>
                      </fieldset>
                    )}
                    {invalid && (
                      <p className="text-destructive mt-2 text-sm">
                        {answer?.status ? tf("chooseMeal") : tf("chooseAnswer")}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {(plusOnes.length > 0 || peopleComing.length > 0) && (
        <section className="bg-card space-y-5 rounded-2xl border p-5 shadow-sm sm:p-7">
          <h2 className="text-3xl">{tf("details")}</h2>
          {plusOnes.map((g) => (
            <div key={g.id} className="grid gap-3 sm:grid-cols-2">
              <p className="text-muted-foreground text-sm sm:col-span-2">
                {tf("plusOneName", { host: name(g.plus_one_of ?? "", false) })}
              </p>
              <div className="space-y-1.5">
                <Label htmlFor={`pf-${g.id}`}>{tf("firstName")}</Label>
                <Input
                  id={`pf-${g.id}`}
                  value={state.people[g.id].firstName}
                  maxLength={80}
                  onChange={(e) => setPerson(g.id, { firstName: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`pl-${g.id}`}>{tf("lastName")}</Label>
                <Input
                  id={`pl-${g.id}`}
                  value={state.people[g.id].lastName}
                  maxLength={80}
                  onChange={(e) => setPerson(g.id, { lastName: e.target.value })}
                />
              </div>
            </div>
          ))}
          {peopleComing.map((g) => (
            <div key={g.id} className="space-y-2">
              <Label htmlFor={`d-${g.id}`}>{tf("dietary", { name: name(g.id) })}</Label>
              <Input
                id={`d-${g.id}`}
                value={state.people[g.id].dietary}
                maxLength={500}
                placeholder={tf("dietaryPlaceholder")}
                onChange={(e) => setPerson(g.id, { dietary: e.target.value })}
              />
              {state.people[g.id].dietary && (
                <div className="flex items-start gap-2">
                  <Checkbox
                    id={`dc-${g.id}`}
                    checked={state.people[g.id].dietaryConsent}
                    onCheckedChange={(v) => setPerson(g.id, { dietaryConsent: !!v })}
                  />
                  <label htmlFor={`dc-${g.id}`} className="text-muted-foreground text-xs leading-snug">
                    {tf("dietaryConsent")}
                  </label>
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      <section className="bg-card space-y-5 rounded-2xl border p-5 shadow-sm sm:p-7">
        {data.wedding.rsvp_ask_song && (
          <div className="space-y-1.5">
            <Label htmlFor="song">{tf("song")}</Label>
            <Input
              id="song"
              value={state.songRequest}
              maxLength={200}
              placeholder={tf("songPlaceholder")}
              onChange={(e) => onStateChange({ ...state, songRequest: e.target.value })}
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="message">{tf("message", { couple })}</Label>
          <Textarea
            id="message"
            rows={3}
            maxLength={2000}
            value={state.message}
            onChange={(e) => onStateChange({ ...state, message: e.target.value })}
          />
        </div>
      </section>

      <p className="text-muted-foreground text-center text-xs leading-relaxed">
        {tf("consentNotice", { couple })}{" "}
        <Link href="/privacy" target="_blank" className="underline underline-offset-2 hover:text-foreground">
          {tf("privacyLink")}
        </Link>
      </p>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {submitLabel ?? t("send")}
      </Button>
    </form>
  );
}

/** Pill-shaped radio button. */
function Choice({
  selected,
  onClick,
  icon,
  muted,
  title,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  muted?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      title={title}
      className={cn(
        "focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none",
        selected
          ? muted
            ? "border-foreground/40 bg-muted font-medium"
            : "border-primary bg-primary text-primary-foreground font-medium"
          : "bg-background hover:bg-accent",
      )}
    >
      {selected && icon}
      {children}
    </button>
  );
}
