import { cache } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { BILLING_ENABLED } from "@/lib/billing/config";
import { RsvpExperience } from "@/components/rsvp/rsvp-experience";
import { PasswordGate } from "@/components/website/password-gate";
import { Site } from "@/components/website/site";
import { LOCALE_CODES } from "@/i18n/locales";
import { fmtDate } from "@/lib/i18n/format";
import { loadRsvp, weddingCountry } from "@/lib/rsvp/page-data";
import { getSiteUrl } from "@/lib/site-url";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { siteCookie } from "@/lib/website/cookie";
import { siteFontVariables } from "@/lib/website/fonts";
import { loadPublicSite } from "@/lib/website/load";

const load = cache(async (slug: string) => {
  if (!isSupabaseConfigured || !/^[a-z0-9-]{3,60}$/.test(slug)) return null;
  const token = (await cookies()).get(siteCookie(slug))?.value ?? null;
  return loadPublicSite(await createClient(), slug, token, await getLocale());
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const [site, t, locale] = await Promise.all([load(slug), getTranslations("site"), getLocale()]);
  if (!site) return { title: t("meta.website"), robots: { index: false } };
  if (site.locked) return { title: { absolute: site.couple }, robots: { index: false } };

  const w = site.data.wedding;
  const couple = `${w.partner_a_name} & ${w.partner_b_name}`;
  const when = w.wedding_date ? fmtDate(w.wedding_date, locale, "long") : null;
  const home = site.data.sections.find((s) => s.kind === "home");
  const tagline = home && "tagline" in home.content ? home.content.tagline : null;
  const description =
    [tagline, [when, w.location].filter(Boolean).join(" · ")].filter(Boolean).join(" – ") ||
    t("meta.weddingOf", { couple });
  const indexable = site.published && !site.hasPassword;
  // Tell search engines about the other language versions of this page.
  const base = `${await getSiteUrl()}/w/${w.slug}`;
  const languages = Object.fromEntries(
    w.languages
      .filter((l) => (LOCALE_CODES as string[]).includes(l))
      .map((l) => [l, `${base}?lang=${l}`]),
  );
  return {
    title: { absolute: when ? `${couple} · ${when}` : couple },
    description,
    robots: { index: indexable, follow: indexable },
    alternates: {
      canonical: `/w/${w.slug}`,
      languages: w.languages.length > 1 ? languages : undefined,
    },
    openGraph: { type: "website", title: couple, description, url: `/w/${w.slug}`, locale },
    twitter: { card: "summary_large_image", title: couple, description },
  };
}

/** "Made with Vow" in the footer: always while payments are off, then only on the free plan. */
async function showsBranding(slug: string) {
  if (!BILLING_ENABLED) return true;
  const { data, error } = await (await createClient()).rpc("site_shows_branding", { p_slug: slug });
  if (error) console.error("[site_shows_branding]", error);
  return data ?? true;
}

/** /w/ian-and-maria — the couple's public wedding website, in the visitor's language. */
/**
 * The guest's own reply form, when they came with their personal link
 * (/w/<slug>?code=K7P2QX). Only for a code of this wedding.
 */
async function guestRsvp(slug: string, code: string | undefined) {
  if (!code) return null;
  const found = await loadRsvp(code);
  if (!found || found.data.wedding.slug !== slug) return null;
  if (found.data.invites.length === 0) {
    const t = await getTranslations("rsvp");
    return <p className="bg-card rounded-2xl border p-8 text-center">{t("nothingYet")}</p>;
  }
  const w = found.data.wedding;
  return (
    <RsvpExperience
      data={found.data}
      originals={found.originals}
      siteUrl={await getSiteUrl()}
      destination={await weddingCountry(w.destination_airport, w.location)}
    />
  );
}

export default async function WeddingWebsite({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ code?: string | string[] }>;
}) {
  const { slug } = await params;
  const { code } = await searchParams;
  const [site, t] = await Promise.all([load(slug), getTranslations("site.preview")]);
  if (!site) notFound();
  const rsvp = site.locked
    ? null
    : await guestRsvp(slug, typeof code === "string" ? code : undefined);

  return (
    <div className={siteFontVariables}>
      {site.locked ? (
        <PasswordGate
          slug={slug}
          couple={site.couple}
          look={site.look}
          languages={site.languages}
        />
      ) : (
        <>
          {!site.published && (
            <div
              role="status"
              className="bg-foreground text-background flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center text-sm"
            >
              <Eye className="size-4" aria-hidden />
              {t("bar")}
              <Link href="/app/website" className="underline underline-offset-2">
                {t("back")}
              </Link>
            </div>
          )}
          <Site data={site.data} branding={await showsBranding(slug)} rsvp={rsvp} />
        </>
      )}
    </div>
  );
}
