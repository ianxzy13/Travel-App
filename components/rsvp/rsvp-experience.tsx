"use client";

import { useState } from "react";
import { CalendarClock, Check, Heart, Minus, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { submitRsvp } from "@/app/r/actions";
import { Button } from "@/components/ui/button";
import { fmtDate } from "@/lib/i18n/format";
import { answerKey, initialFormState, rsvpGuestName, type RsvpFormState } from "@/lib/rsvp/form";
import type { RsvpData } from "@/lib/rsvp/types";
import { RsvpForm, useGuestNameLabels } from "./rsvp-form";
import { RsvpTravelForm } from "./rsvp-travel-form";

type View = "summary" | "form" | "thanks" | "travel";

/** The guest's journey on /r/[code]: see answers → edit → thank you. */
export function RsvpExperience({ data }: { data: RsvpData }) {
  const t = useTranslations("rsvp");
  const locale = useLocale();
  const [answered, setAnswered] = useState(!!data.household.responded_at);
  const closed = data.wedding.deadline_passed;
  const [view, setView] = useState<View>(answered || closed ? "summary" : "form");
  const [state, setState] = useState<RsvpFormState>(() => initialFormState(data));
  const deadline = data.wedding.rsvp_deadline
    ? fmtDate(data.wedding.rsvp_deadline, locale, "long")
    : null;
  const couple = `${data.wedding.partner_a_name} & ${data.wedding.partner_b_name}`;

  const anyAttending = Object.values(state.answers).some((a) => a.status === "attending");
  const showTravelPrompt = data.wedding.rsvp_ask_travel && anyAttending;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="font-serif text-3xl">{t("dear", { name: data.household.name })}</p>
        {view === "form" && (
          <p className="text-muted-foreground mt-2">
            {answered ? t("update") : t("invite")}
            {deadline && ` ${t("replyBy", { date: deadline })}`}
          </p>
        )}
      </div>

      {closed && (
        <div role="status" className="bg-card flex gap-3 rounded-2xl border p-5">
          <CalendarClock className="text-primary-ink mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="text-sm">
            <p className="font-medium">{t("closed")}</p>
            <p className="text-muted-foreground mt-1">
              {data.wedding.rsvp_contact
                ? t("closedContact", { contact: data.wedding.rsvp_contact })
                : t("closedNoContact")}
            </p>
          </div>
        </div>
      )}

      {view === "thanks" && (
        <>
          <div role="status" className="bg-card rounded-2xl border p-8 text-center shadow-sm">
            <Heart className="text-primary-ink mx-auto size-10" aria-hidden />
            <h2 className="font-script mt-4 text-5xl font-normal">{t("thanks")}</h2>
            <p className="text-muted-foreground mt-2">
              {deadline
                ? t("thanksTextUntil", { couple, date: deadline })
                : t("thanksText", { couple })}
            </p>
          </div>
          {showTravelPrompt && (
            <Button
              size="lg"
              className="w-full"
              onClick={() => {
                setView("travel");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              {t("travel.prompt")}
            </Button>
          )}
        </>
      )}

      {view === "travel" && (
        <RsvpTravelForm
          data={data}
          onSaved={() => {
            setView("summary");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          onSkip={() => {
            setView("summary");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
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
          submitLabel={answered ? t("save") : t("send")}
        />
      ) : view !== "travel" ? (
        <>
          <AnswerSummary data={data} state={state} />
          {!closed && (
            <div className="space-y-3">
              <Button
                size="lg"
                variant="outline"
                className="w-full"
                onClick={() => setView("form")}
              >
                {t("change")}
              </Button>
              {showTravelPrompt && (
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setView("travel");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  {t("travel.editTravel")}
                </Button>
              )}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

/** Read-only list of who's coming to what. */
function AnswerSummary({ data, state }: { data: RsvpData; state: RsvpFormState }) {
  const t = useTranslations("rsvp");
  const labels = useGuestNameLabels();
  const meals = new Map(data.meal_options.map((m) => [m.id, m.name]));
  return (
    <div className="bg-card space-y-5 rounded-2xl border p-5 shadow-sm sm:p-7">
      <h2 className="text-3xl">{t("yourAnswers")}</h2>
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
                      <Check
                        className="text-success size-4"
                        role="img"
                        aria-label={t("attending")}
                      />
                    ) : a?.status === "declined" ? (
                      <X
                        className="text-muted-foreground size-4"
                        role="img"
                        aria-label={t("notAttending")}
                      />
                    ) : (
                      <Minus
                        className="text-muted-foreground size-4"
                        role="img"
                        aria-label={t("noAnswer")}
                      />
                    )}
                    <span>{rsvpGuestName(data, i.guest_id, state, labels)}</span>
                    <span className="text-muted-foreground">
                      {a?.status === "attending"
                        ? meal
                          ? `· ${meal}`
                          : ""
                        : a?.status === "declined"
                          ? `· ${t("cantMakeIt")}`
                          : `· ${t("noAnswerYet")}`}
                    </span>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
      {(state.songRequest || state.message) && (
        <div className="text-muted-foreground space-y-1 border-t pt-4 text-sm">
          {state.songRequest && <p>{t("songRequest", { song: state.songRequest })}</p>}
          {state.message && <p className="whitespace-pre-line">“{state.message}”</p>}
        </div>
      )}
    </div>
  );
}
