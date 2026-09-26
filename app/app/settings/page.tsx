import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { Collaborators } from "@/components/settings/collaborators";
import { DangerZone } from "@/components/settings/danger-zone";
import { EventsCard } from "@/components/settings/events-card";
import { WeddingDetailsForm } from "@/components/settings/wedding-details-form";
import { getSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import type { WeddingFormValues } from "@/lib/validation/wedding";
import { canEdit, requireUser, requireWedding } from "@/lib/wedding";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const { wedding, role } = await requireWedding();
  const supabase = await createClient();
  const isOwner = role === "owner";

  const [{ data: members }, { data: invitations }] = await Promise.all([
    supabase
      .from("wedding_members")
      .select("id, role, user_id, profile:profiles(full_name, email, avatar_url)")
      .eq("wedding_id", wedding.id)
      .order("created_at"),
    // Only owners can see invitations (the database enforces this too).
    isOwner
      ? supabase
          .from("wedding_invitations")
          .select("id, email, role, token, expires_at")
          .eq("wedding_id", wedding.id)
          .is("accepted_at", null)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const { data: bookedVenues } = await supabase
    .from("venues")
    .select("id, name, address")
    .eq("wedding_id", wedding.id)
    .eq("status", "booked");
  const { data: events } = await supabase
    .from("events")
    .select("*")
    .eq("wedding_id", wedding.id)
    .order("sort_order");
  // One small count query per event (events are few; invitations can be many).
  const invitedCounts = await Promise.all(
    (events ?? []).map(async (e) => {
      const { count } = await supabase
        .from("guest_event_invites")
        .select("id", { count: "exact", head: true })
        .eq("event_id", e.id);
      return count ?? 0;
    }),
  );

  const siteUrl = await getSiteUrl();

  const values: WeddingFormValues = {
    partnerAName: wedding.partner_a_name,
    partnerBName: wedding.partner_b_name,
    weddingDate: wedding.wedding_date ?? "",
    location: wedding.location ?? "",
    currency: wedding.currency,
    estimatedGuests: wedding.estimated_guests?.toString() ?? "",
    styleTags: wedding.style_tags,
    accent: wedding.accent,
  };

  return (
    <>
      <PageHeader
        title="Settings"
        description="Your wedding details, events and who's planning with you."
      />
      <div className="space-y-8">
        <WeddingDetailsForm
          // Re-mount the form when switching weddings so it shows fresh values.
          key={wedding.id}
          defaultValues={values}
          readOnly={!canEdit(role)}
        />
        <EventsCard
          readOnly={!canEdit(role)}
          events={(events ?? []).map((e, i) => ({ ...e, invitedCount: invitedCounts[i] }))}
          bookedVenues={bookedVenues ?? []}
        />
        <Collaborators
          currentUserId={user.id}
          isOwner={isOwner}
          members={(members ?? []).map((m) => ({
            id: m.id,
            role: m.role,
            userId: m.user_id,
            name: m.profile?.full_name ?? null,
            email: m.profile?.email ?? null,
            avatarUrl: m.profile?.avatar_url ?? null,
          }))}
          invitations={(invitations ?? []).map((i) => ({
            id: i.id,
            email: i.email,
            role: i.role,
            expiresAt: i.expires_at,
            link: `${siteUrl}/invite/${i.token}`,
          }))}
        />
        <DangerZone
          isOwner={isOwner}
          weddingName={`${wedding.partner_a_name} & ${wedding.partner_b_name}`}
        />
      </div>
    </>
  );
}
