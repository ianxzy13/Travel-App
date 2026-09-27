import { cache } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { PasswordGate } from "@/components/website/password-gate";
import { Site } from "@/components/website/site";
import { LOCALE_CODES } from "@/i18n/locales";
import { fmtDate } from "@/lib/i18n/format";
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

/** /w/ian-and-maria — the couple's public wedding website, in the visitor's language. */
export default async function WeddingWebsite({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [site, t] = await Promise.all([load(slug), getTranslations("site.preview")]);
  if (!site) notFound();

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
          <Site data={site.data} />
        </>
      )}
    </div>
  );
}
