import type { Metadata } from "next";
import Link from "next/link";
import {
  Armchair,
  CalendarPlus,
  CheckCircle2,
  Circle,
  ListChecks,
  MailCheck,
  MapPin,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Countdown } from "@/components/dashboard/countdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatWeddingDate } from "@/lib/format";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { canEdit, coupleName, requireWedding } from "@/lib/wedding";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { wedding, role } = await requireWedding();
  const { welcome } = await searchParams;
  const supabase = await createClient();

  const rsvp = await rsvpSummary(supabase, wedding.id);
  const [{ count: memberCount }, { count: guestCount }] = await Promise.all([
    supabase
      .from("wedding_members")
      .select("id", { count: "exact", head: true })
      .eq("wedding_id", wedding.id),
    supabase
      .from("guests")
      .select("id", { count: "exact", head: true })
      .eq("wedding_id", wedding.id),
  ]);

  // Suggestions based on what's still missing. More are added in later phases.
  const steps: { label: string; href: string; done: boolean }[] = [
    { label: "Set your wedding date", href: "/app/settings", done: !!wedding.wedding_date },
    { label: "Choose a location", href: "/app/settings", done: !!wedding.location },
    {
      label: "Invite your partner, family or planner",
      href: "/app/settings#collaborators",
      done: (memberCount ?? 1) > 1,
    },
    {
      label: guestCount ? `Add your guest list (${guestCount} so far)` : "Add your guest list",
      href: "/app/guests",
      done: (guestCount ?? 0) > 0,
    },
    { label: "Set your total budget", href: "/app/budget", done: false },
    { label: "Shortlist venues", href: "/app/venues", done: false },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <div className="space-y-6">
      {welcome && (
        <div role="status" className="bg-primary-soft rounded-xl px-5 py-4">
          <p className="font-serif text-2xl font-semibold">Welcome to your planner!</p>
          <p className="text-muted-foreground text-sm">
            Everything starts here. Work through the next steps below at your own pace.
          </p>
        </div>
      )}

      {/* Countdown hero */}
      <Card className="overflow-hidden">
        <CardContent className="relative p-6 sm:p-8">
          <div
            aria-hidden
            className="bg-primary-soft pointer-events-none absolute -top-24 -right-24 size-72 rounded-full blur-2xl"
          />
          <div className="relative">
            <h1 className="text-4xl sm:text-5xl">{coupleName(wedding)}</h1>
            <p className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>{formatWeddingDate(wedding.wedding_date, "EEEE d MMMM yyyy")}</span>
              {wedding.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-4" aria-hidden />
                  {wedding.location}
                </span>
              )}
            </p>
            <div className="mt-8">
              {wedding.wedding_date ? (
                <Countdown date={wedding.wedding_date} />
              ) : (
                canEdit(role) && (
                  <Button asChild>
                    <Link href="/app/settings">
                      <CalendarPlus aria-hidden /> Set your date to start the countdown
                    </Link>
                  </Button>
                )
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Next steps */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="font-serif text-2xl">Next steps</CardTitle>
            <p className="text-muted-foreground text-sm">
              {doneCount} of {steps.length} done
            </p>
            <div className="bg-muted h-1.5 rounded-full">
              <div
                className="bg-primary h-1.5 rounded-full transition-all"
                style={{ width: `${(doneCount / steps.length) * 100}%` }}
              />
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {steps.map((s) => (
                <li key={s.label}>
                  <Link
                    href={s.href}
                    className="hover:bg-accent flex items-center gap-3 rounded-lg px-2 py-2 text-sm"
                  >
                    {s.done ? (
                      <CheckCircle2 className="text-success size-5 shrink-0" aria-hidden />
                    ) : (
                      <Circle className="text-muted-foreground size-5 shrink-0" aria-hidden />
                    )}
                    <span className={cn(s.done && "text-muted-foreground line-through")}>
                      {s.label}
                    </span>
                    <span className="sr-only">{s.done ? "(done)" : "(to do)"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Module summaries (filled with real numbers in later phases) */}
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
          <SummaryCard
            icon={Wallet}
            title="Budget"
            empty="No budget yet. Set a total and we'll suggest how to split it."
            href="/app/budget"
            cta="Plan budget"
          />
          <SummaryCard
            icon={MailCheck}
            title="RSVPs"
            empty="No replies yet. Add guests, then send your invitations."
            href="/app/rsvp"
            cta="View RSVPs"
          >
            {rsvp.invited > 0 && (
              <dl className="grid grid-cols-3 gap-2 text-center">
                {(
                  [
                    ["Attending", rsvp.attending],
                    ["Declined", rsvp.declined],
                    ["Waiting", rsvp.waiting],
                  ] as const
                ).map(([label, n]) => (
                  <div key={label} className="bg-muted rounded-lg p-2">
                    <dd className="font-serif text-3xl font-semibold tabular-nums">{n}</dd>
                    <dt className="text-muted-foreground text-xs">{label}</dt>
                  </div>
                ))}
              </dl>
            )}
          </SummaryCard>
          <SummaryCard
            icon={Armchair}
            title="Seating"
            empty="No tables yet. Once guests reply, seat them with drag and drop."
            href="/app/seating"
            cta="Open seating chart"
          />
          <SummaryCard
            icon={ListChecks}
            title="To-dos"
            empty="Nothing due. We'll build a timeline from your wedding date."
            href="/app/tasks"
            cta="See to-dos"
          />
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  title,
  empty,
  href,
  cta,
  children,
}: {
  icon: LucideIcon;
  title: string;
  empty: string;
  href: string;
  cta: string;
  /** real numbers; the "empty" text shows when there are none */
  children?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex items-center gap-3">
        <span className="bg-primary-soft text-primary inline-flex size-9 items-center justify-center rounded-full">
          <Icon className="size-4" aria-hidden />
        </span>
        <CardTitle className="font-serif text-2xl">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {children || <p className="text-muted-foreground text-sm">{empty}</p>}
        <Button asChild variant="outline" size="sm">
          <Link href={href}>{cta}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

/** People coming to at least one event / declined everything / not answered anything yet. */
async function rsvpSummary(supabase: Awaited<ReturnType<typeof createClient>>, weddingId: string) {
  const [invites, responses] = await Promise.all([
    fetchAll((f, t) =>
      supabase
        .from("guest_event_invites")
        .select("guest_id")
        .eq("wedding_id", weddingId)
        .order("id")
        .range(f, t),
    ),
    fetchAll((f, t) =>
      supabase
        .from("rsvp_responses")
        .select("guest_id, status")
        .eq("wedding_id", weddingId)
        .order("id")
        .range(f, t),
    ),
  ]);
  const invited = new Set(invites.map((i) => i.guest_id));
  const answered = new Set(responses.map((r) => r.guest_id));
  const attending = new Set(
    responses.filter((r) => r.status === "attending").map((r) => r.guest_id),
  );
  return {
    invited: invited.size,
    attending: attending.size,
    declined: [...answered].filter((id) => !attending.has(id)).length,
    waiting: [...invited].filter((id) => !answered.has(id)).length,
  };
}
