import { cache } from "react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { CodeForm } from "@/components/rsvp/code-form";
import { RsvpExperience } from "@/components/rsvp/rsvp-experience";
import { RsvpFrame } from "@/components/rsvp/rsvp-frame";
import { starterTexts } from "@/lib/i18n/defaults";
import { localizeRsvp } from "@/lib/rsvp/localize";
import { CODE_PATTERN, normalizeCode, type RsvpData, type RsvpExtras } from "@/lib/rsvp/types";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

// Loads one household's RSVP via the secure get_rsvp() function (null if the code is wrong),
// with the couple's texts in the page's language.
const loadRsvp = cache(async (rawCode: string) => {
  const code = normalizeCode(decodeURIComponent(rawCode));
  if (!CODE_PATTERN.test(code) || !isSupabaseConfigured) return null;
  const supabase = await createClient();
  const [{ data, error }, { data: extras }, locale] = await Promise.all([
    supabase.rpc("get_rsvp", { p_code: code }),
    supabase.rpc("get_rsvp_extras", { p_code: code }),
    getLocale(),
  ]);
  if (error) console.error("[get_rsvp]", error);
  if (!data) return null;
  const x = extras as RsvpExtras | null;
  const shown = await starterTexts(locale);
  return {
    data: localizeRsvp(data as RsvpData, x, locale, shown),
    languages: x?.languages ?? [],
  };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const [found, t] = await Promise.all([loadRsvp((await params).code), getTranslations("rsvp")]);
  const w = found?.data.wedding;
  return {
    title: {
      absolute: w ? `${t("title")} · ${w.partner_a_name} & ${w.partner_b_name}` : t("title"),
    },
    robots: { index: false, follow: false }, // private links: keep out of search engines
  };
}

export default async function RsvpPage({ params }: { params: Promise<{ code: string }> }) {
  const [found, t] = await Promise.all([loadRsvp((await params).code), getTranslations("rsvp")]);

  if (!found) {
    return (
      <RsvpFrame>
        <div className="bg-card mx-auto mt-10 max-w-md rounded-2xl border p-8 shadow-sm">
          <h1 className="text-center text-4xl">{t("notFound")}</h1>
          <p className="text-muted-foreground mt-2 mb-6 text-center">{t("notFoundText")}</p>
          <CodeForm />
        </div>
      </RsvpFrame>
    );
  }

  const { data, languages } = found;
  const w = data.wedding;
  return (
    <RsvpFrame
      accent={w.accent}
      couple={`${w.partner_a_name} & ${w.partner_b_name}`}
      date={w.wedding_date}
      location={w.location}
      languages={languages}
      code={data.household.code}
    >
      {data.invites.length === 0 ? (
        <p className="bg-card rounded-2xl border p-8 text-center">{t("nothingYet")}</p>
      ) : (
        <RsvpExperience data={data} />
      )}
    </RsvpFrame>
  );
}
