import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { CodeForm } from "@/components/rsvp/code-form";
import { FindInvitation } from "@/components/rsvp/find-invitation";
import { RsvpFrame } from "@/components/rsvp/rsvp-frame";
import { GuestFlightForm, type GuestFlights } from "@/components/website/guest-flight-form";
import type { Accent, Translations } from "@/lib/database.types";
import { localized } from "@/lib/i18n/content";
import { CODE_PATTERN, normalizeCode } from "@/lib/rsvp/types";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

type FlightFormWedding = {
  slug: string;
  partner_a_name: string;
  partner_b_name: string;
  wedding_date: string | null;
  location: string | null;
  accent: Accent;
  languages: string[];
  destination_airport: string | null;
  translations: Translations;
};

// null when there's no such wedding or the couple switched the form off
const loadForm = cache(async (slug: string) => {
  if (!isSupabaseConfigured || !/^[a-z0-9-]{3,60}$/.test(slug)) return null;
  const supabase = await createClient();
  const [{ data, error }, locale] = await Promise.all([
    supabase.rpc("get_flight_form", { p_slug: slug }),
    getLocale(),
  ]);
  if (error) console.error("[get_flight_form]", error);
  const w = data as FlightFormWedding | null;
  return w ? localized(w, locale, ["location"]) : null;
});

const loadFlights = cache(async (slug: string, rawCode: string) => {
  const code = normalizeCode(rawCode);
  if (!CODE_PATTERN.test(code)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_guest_flights", { p_slug: slug, p_code: code });
  if (error) console.error("[get_guest_flights]", error);
  return data as GuestFlights | null;
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const [w, t] = await Promise.all([loadForm((await params).slug), getTranslations("flightForm")]);
  return {
    title: {
      absolute: w ? `${t("title")} · ${w.partner_a_name} & ${w.partner_b_name}` : t("title"),
    },
    robots: { index: false, follow: false },
  };
}

/** /w/ian-and-maria/flights — guests share their flights; they land on the couple's board. */
export default async function GuestFlightsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ code?: string }>;
}) {
  const { slug } = await params;
  const { code } = await searchParams;
  const [w, t] = await Promise.all([loadForm(slug), getTranslations("flightForm")]);
  if (!w) notFound();
  const couple = `${w.partner_a_name} & ${w.partner_b_name}`;
  const found = code ? await loadFlights(slug, code) : null;

  return (
    <RsvpFrame
      accent={w.accent}
      couple={couple}
      date={w.wedding_date}
      location={w.location}
      languages={w.languages}
      code={found?.household.code}
    >
      {found ? (
        <GuestFlightForm
          slug={w.slug}
          couple={couple}
          airport={w.destination_airport}
          data={found}
        />
      ) : (
        <div className="bg-card mx-auto max-w-md space-y-8 rounded-2xl border p-8 shadow-sm">
          <div>
            <h2 className="text-center text-4xl">{t("title")}</h2>
            {code && (
              <p role="alert" className="text-destructive mt-3 text-center text-sm">
                {t("notFound")}
              </p>
            )}
            <p className="text-muted-foreground mt-2 mb-6 text-center">{t("findIntro")}</p>
            <FindInvitation slug={w.slug} next="flights" />
          </div>
          <div className="border-t pt-6">
            <CodeForm next={`/w/${w.slug}/flights`} />
          </div>
        </div>
      )}
    </RsvpFrame>
  );
}
