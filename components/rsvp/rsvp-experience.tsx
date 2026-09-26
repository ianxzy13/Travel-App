"use client";

import { useState } from "react";
import { CalendarClock, Check, Heart, Minus, X } from "lucide-react";
import { submitRsvp } from "@/app/r/actions";
import { Button } from "@/components/ui/button";
import { formatWeddingDate } from "@/lib/format";
import { answerKey, initialFormState, rsvpGuestName, type RsvpFormState } from "@/lib/rsvp/form";
import type { RsvpData } from "@/lib/rsvp/types";
import { RsvpForm } from "./rsvp-form";

type View = "summary" | "form" | "thanks";

/** The guest's journey on /r/[code]: see answers → edit → thank you. */
export function RsvpExperience({ data }: { data: RsvpData }) {
  const [answered, setAnswered] = useState(!!data.household.responded_at);
  const closed = data.wedding.deadline_passed;
  const [view, setView] = useState<View>(answered || closed ? "summary" : "form");
  const [state, setState] = useState<RsvpFormState>(() => initialFormState(data));
  const deadline = data.wedding.rsvp_deadline
    ? formatWeddingDate(data.wedding.rsvp_deadline, "d MMMM yyyy")
    : null;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="font-serif text-3xl">Dear {data.household.name},</p>
        {view === "form" && (
          <p className="text-muted-foreground mt-2">
            {answered ? "Update your answers below." : "We'd love to know if you can join us."}
            {deadline && ` Please reply by ${deadline}.`}
          </p>
        )}
      </div>

      {closed && (
        <div role="status" className="bg-card flex gap-3 rounded-2xl border p-5">
          <CalendarClock className="text-primary mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="text-sm">
            <p className="font-medium">The RSVP deadline has passed.</p>
            <p className="text-muted-foreground mt-1">
              {data.wedding.rsvp_contact
                ? `Need to change something? ${data.wedding.rsvp_contact}`
                : "Need to change something? Please contact the couple directly."}
            </p>
          </div>
        </div>
      )}

      {view === "thanks" && (
        <div role="status" className="bg-card rounded-2xl border p-8 text-center shadow-sm">
          <Heart className="text-primary mx-auto size-10" aria-hidden />
          <h2 className="mt-3 text-4xl">Thank you!</h2>
          <p className="text-muted-foreground mt-2">
            Your RSVP has been sent to {data.wedding.partner_a_name} &amp;{" "}
            {data.wedding.partner_b_name}. You can change it any time using this same link
            {deadline ? ` until ${deadline}` : ""}.
          </p>
        </div>
      )}

      {view === "form" && !closed ? (
        <RsvpForm
          data={data}
          state={state}
          onStateChange={setState}
          onSubmit={(payload) => submitRsvp(data.household.code, payload)}
          onSaved={() => {
            setAnswered(true);
            setView("thanks");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          submitLabel={answered ? "Save changes" : "Send our RSVP"}
        />
      ) : (
        <>
          <AnswerSummary data={data} state={state} />
          {!closed && (
            <Button size="lg" variant="outline" className="w-full" onClick={() => setView("form")}>
              Change our answers
            </Button>
          )}
        </>
      )}
    </div>
  );
}

/** Read-only list of who's coming to what. */
function AnswerSummary({ data, state }: { data: RsvpData; state: RsvpFormState }) {
  const meals = new Map(data.meal_options.map((m) => [m.id, m.name]));
  return (
    <div className="bg-card space-y-5 rounded-2xl border p-5 shadow-sm sm:p-7">
      <h2 className="text-3xl">Your answers</h2>
      {data.events.map((event) => (
        <div key={event.id}>
          <h3 className="font-sans text-sm font-medium tracking-wide uppercase">{event.name}</h3>
          <ul className="mt-2 space-y-1.5">
            {data.invites
              .filter((i) => i.event_id === event.id)
              .map((i) => {
                const a = state.answers[answerKey(i.guest_id, event.id)];
                const meal = a?.mealOptionId ? meals.get(a.mealOptionId) : null;
                return (
                  <li key={i.guest_id} className="flex items-center gap-2 text-sm">
                    {a?.status === "attending" ? (
                      <Check className="text-success size-4" aria-label="Attending" />
                    ) : a?.status === "declined" ? (
                      <X className="text-muted-foreground size-4" aria-label="Not attending" />
                    ) : (
                      <Minus className="text-muted-foreground size-4" aria-label="No answer yet" />
                    )}
                    <span>{rsvpGuestName(data, i.guest_id, state)}</span>
                    <span className="text-muted-foreground">
                      {a?.status === "attending"
                        ? meal
                          ? `· ${meal}`
                          : ""
                        : a?.status === "declined"
                          ? "· can't make it"
                          : "· no answer yet"}
                    </span>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
      {(state.songRequest || state.message) && (
        <div className="text-muted-foreground space-y-1 border-t pt-4 text-sm">
          {state.songRequest && <p>Song request: {state.songRequest}</p>}
          {state.message && <p className="whitespace-pre-line">“{state.message}”</p>}
        </div>
      )}
    </div>
  );
}
