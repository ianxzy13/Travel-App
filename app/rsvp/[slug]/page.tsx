import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { CodeForm } from "@/components/rsvp/code-form";
import { FindInvitation } from "@/components/rsvp/find-invitation";
import { RsvpFrame } from "@/components/rsvp/rsvp-frame";
import type { Accent, Translations } from "@/lib/database.types";
import { localized } from "@/lib/i18n/content";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

type PublicWedding = {
  slug: string;
  partner_a_name: string;
  partner_b_name: string;
  wedding_date: string | null;
  location: string | null;
  accent: Accent;
  languages: string[];
  translations: Translations;
};

const loadWedding = cache(async (slug: string) => {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const [{ data }, locale] = await Promise.all([
    supabase.rpc("get_wedding_public", { p_slug: slug }),
    getLocale(),
  ]);
  const w = data as PublicWedding | null;
  return w ? localized(w, locale, ["location"]) : null;
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const [w, t] = await Promise.all([loadWedding((await params).slug), getTranslations("rsvp")]);
  return {
    title: {
      absolute: w ? `${t("title")} · ${w.partner_a_name} & ${w.partner_b_name}` : t("title"),
    },
    robots: { index: false },
  };
}

/** /rsvp/ian-and-maria — find your invitation by name (linked from the wedding website). */
export default async function FindInvitationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [w, t] = await Promise.all([loadWedding(slug), getTranslations("rsvp")]);
  if (!w) notFound();

  return (
    <RsvpFrame
      accent={w.accent}
      couple={`${w.partner_a_name} & ${w.partner_b_name}`}
      date={w.wedding_date}
      location={w.location}
      languages={w.languages}
    >
      <div className="bg-card mx-auto max-w-md space-y-8 rounded-2xl border p-8 shadow-sm">
        <div>
          <h2 className="text-center text-4xl">{t("title")}</h2>
          <p className="text-muted-foreground mt-2 mb-6 text-center">{t("findIntro")}</p>
          <FindInvitation slug={w.slug} />
        </div>
        <div className="border-t pt-6">
          <p className="text-muted-foreground mb-3 text-center text-sm">{t("orCode")}</p>
          <CodeForm />
        </div>
      </div>
    </RsvpFrame>
  );
}
