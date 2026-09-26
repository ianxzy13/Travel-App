import { cache } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye } from "lucide-react";
import { PasswordGate } from "@/components/website/password-gate";
import { Site } from "@/components/website/site";
import { formatWeddingDate } from "@/lib/format";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { siteCookie } from "@/lib/website/cookie";
import { siteFontVariables } from "@/lib/website/fonts";
import { loadPublicSite } from "@/lib/website/load";

const load = cache(async (slug: string) => {
  if (!isSupabaseConfigured || !/^[a-z0-9-]{3,60}$/.test(slug)) return null;
  const token = (await cookies()).get(siteCookie(slug))?.value ?? null;
  return loadPublicSite(await createClient(), slug, token);
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const site = await load(slug);
  if (!site) return { title: "Wedding website", robots: { index: false } };
  if (site.locked) return { title: { absolute: site.couple }, robots: { index: false } };

  const w = site.data.wedding;
  const couple = `${w.partner_a_name} & ${w.partner_b_name}`;
  const when = w.wedding_date ? formatWeddingDate(w.wedding_date, "d MMMM yyyy") : null;
  const tagline = site.data.sections.find((s) => s.kind === "home")?.content;
  const description =
    [
      tagline && "tagline" in tagline ? tagline.tagline : null,
      [when, w.location].filter(Boolean).join(" · "),
    ]
      .filter(Boolean)
      .join(" – ") || `The wedding of ${couple}`;
  return {
    title: { absolute: when ? `${couple} · ${when}` : couple },
    description,
    // Only published sites without a password may appear in search engines.
    robots: { index: site.published && !site.hasPassword, follow: site.published && !site.hasPassword },
    alternates: { canonical: `/w/${w.slug}` },
    openGraph: { type: "website", title: couple, description, url: `/w/${w.slug}` },
    twitter: { card: "summary_large_image", title: couple, description },
  };
}

/** /w/ian-and-maria — the couple's public wedding website. */
export default async function WeddingWebsite({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = await load(slug);
  if (!site) notFound();

  return (
    <div className={siteFontVariables}>
      {site.locked ? (
        <PasswordGate slug={slug} couple={site.couple} look={site.look} />
      ) : (
        <>
          {!site.published && (
            <div role="status" className="bg-foreground text-background flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center text-sm">
              <Eye className="size-4" aria-hidden />
              Preview: only your wedding team can see this until you publish it.
              <Link href="/app/website" className="underline underline-offset-2">
                Back to the editor
              </Link>
            </div>
          )}
          <Site data={site.data} />
        </>
      )}
    </div>
  );
}
