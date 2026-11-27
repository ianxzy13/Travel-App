import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CodeForm } from "@/components/rsvp/code-form";
import { RsvpExperience } from "@/components/rsvp/rsvp-experience";
import { RsvpFrame } from "@/components/rsvp/rsvp-frame";
import { coverUrl, loadRsvp, weddingCountry } from "@/lib/rsvp/page-data";
import { getSiteUrl } from "@/lib/site-url";

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

  const { data, originals, languages } = found;
  const w = data.wedding;
  return (
    <RsvpFrame
      cover={await coverUrl(w.rsvp_cover_path)}
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
        <RsvpExperience
          data={data}
          originals={originals}
          siteUrl={await getSiteUrl()}
          destination={await weddingCountry(w.destination_airport, w.location)}
        />
      )}
    </RsvpFrame>
  );
}
