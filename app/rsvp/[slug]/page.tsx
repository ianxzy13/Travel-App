import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CodeForm } from "@/components/rsvp/code-form";
import { FindInvitation } from "@/components/rsvp/find-invitation";
import { RsvpFrame } from "@/components/rsvp/rsvp-frame";
import type { Accent } from "@/lib/database.types";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

type PublicWedding = {
  slug: string;
  partner_a_name: string;
  partner_b_name: string;
  wedding_date: string | null;
  location: string | null;
  accent: Accent;
};

const loadWedding = cache(async (slug: string) => {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_wedding_public", { p_slug: slug });
  return (data as PublicWedding | null) ?? null;
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const w = await loadWedding((await params).slug);
  return {
    title: w ? `RSVP · ${w.partner_a_name} & ${w.partner_b_name}` : "RSVP",
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
  const w = await loadWedding(slug);
  if (!w) notFound();

  return (
    <RsvpFrame
      accent={w.accent}
      couple={`${w.partner_a_name} & ${w.partner_b_name}`}
      date={w.wedding_date}
      location={w.location}
    >
      <div className="bg-card mx-auto max-w-md space-y-8 rounded-2xl border p-8 shadow-sm">
        <div>
          <h2 className="text-center text-4xl">RSVP</h2>
          <p className="text-muted-foreground mt-2 mb-6 text-center">
            Find your invitation by typing your name as it appears on the invitation.
          </p>
          <FindInvitation slug={w.slug} />
        </div>
        <div className="border-t pt-6">
          <p className="text-muted-foreground mb-3 text-center text-sm">
            Or use the code from your invitation
          </p>
          <CodeForm />
        </div>
      </div>
    </RsvpFrame>
  );
}
