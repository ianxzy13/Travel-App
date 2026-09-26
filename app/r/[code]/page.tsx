import { cache } from "react";
import type { Metadata } from "next";
import { CodeForm } from "@/components/rsvp/code-form";
import { RsvpExperience } from "@/components/rsvp/rsvp-experience";
import { RsvpFrame } from "@/components/rsvp/rsvp-frame";
import { CODE_PATTERN, normalizeCode, type RsvpData } from "@/lib/rsvp/types";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

// Loads one household's RSVP via the secure get_rsvp() function (null if the code is wrong).
const loadRsvp = cache(async (rawCode: string): Promise<RsvpData | null> => {
  const code = normalizeCode(decodeURIComponent(rawCode));
  if (!CODE_PATTERN.test(code) || !isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_rsvp", { p_code: code });
  if (error) console.error("[get_rsvp]", error);
  return (data as RsvpData | null) ?? null;
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const data = await loadRsvp((await params).code);
  return {
    title: data ? `RSVP · ${data.wedding.partner_a_name} & ${data.wedding.partner_b_name}` : "RSVP",
    robots: { index: false, follow: false }, // private links: keep out of search engines
  };
}

export default async function RsvpPage({ params }: { params: Promise<{ code: string }> }) {
  const data = await loadRsvp((await params).code);

  if (!data) {
    return (
      <RsvpFrame>
        <div className="bg-card mx-auto mt-10 max-w-md rounded-2xl border p-8 shadow-sm">
          <h1 className="text-center text-4xl">Invitation not found</h1>
          <p className="text-muted-foreground mt-2 mb-6 text-center">
            That link or code doesn&apos;t match an invitation. Please check it and try again.
          </p>
          <CodeForm />
        </div>
      </RsvpFrame>
    );
  }

  const w = data.wedding;
  return (
    <RsvpFrame
      accent={w.accent}
      couple={`${w.partner_a_name} & ${w.partner_b_name}`}
      date={w.wedding_date}
      location={w.location}
    >
      {data.invites.length === 0 ? (
        <p className="bg-card rounded-2xl border p-8 text-center">
          There&apos;s nothing to RSVP for yet. Please check back later.
        </p>
      ) : (
        <RsvpExperience data={data} />
      )}
    </RsvpFrame>
  );
}
