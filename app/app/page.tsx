import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import {
  Armchair,
  CalendarPlus,
  CheckCircle2,
  Circle,
  Lightbulb,
  ListChecks,
  MailCheck,
  MapPin,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Countdown } from "@/components/dashboard/countdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PaletteStrip } from "@/components/inspiration/palette-strip";
import { PinImage } from "@/components/inspiration/pin-image";
import { loadBudget } from "@/lib/budget/load";
import { summarizeBudget, upcomingPayments } from "@/lib/budget/stats";
import { fmtDate, fmtMoney } from "@/lib/i18n/format";
import { signPaths } from "@/lib/inspiration/load";
import { starterTexts } from "@/lib/i18n/defaults";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { canEdit, coupleName, requireWedding } from "@/lib/wedding";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("app.nav"))("dashboard") };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { wedding, role } = await requireWedding();
  const [t, locale] = await Promise.all([getTranslations("app.dashboard"), getLocale()]);
  const money = (n: number) => fmtMoney(n, wedding.currency, locale);
  const shortDate = (d: string) => fmtDate(d, locale, "medium");
  const { welcome } = await searchParams;
  const supabase = await createClient();

  const today = new Date().toISOString().slice(0, 10);
  const [rsvp, seating, venues, budget, inspiration, website, tasks] = await Promise.all([
    rsvpSummary(supabase, wedding.id),
    seatingSummary(supabase, wedding.id),
    supabase
      .from("venues")
      .select("status")
      .eq("wedding_id", wedding.id)
      .then(({ data }) => ({
        total: data?.length ?? 0,
        booked: data?.filter((v) => v.status === "booked").length ?? 0,
      })),
    loadBudget(supabase, wedding.id).then((b) => ({
      summary: summarizeBudget(
        wedding.budget_total == null ? null : Number(wedding.budget_total),
        b.categories,
        b.expenses,
        b.payments,
      ),
      upcoming: upcomingPayments(
        b.payments,
        b.expenses,
        b.categories,
        new Date().toISOString().slice(0, 10),
      ),
    })),
    inspirationSummary(supabase, wedding.id),
    supabase
      .from("website_settings")
      .select("published")
      .eq("wedding_id", wedding.id)
      .maybeSingle()
      .then(({ data }) => ({ published: !!data?.published })),
    tasksSummary(supabase, wedding.id),
  ]);
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

  // Suggestions based on what's still missing.
  const steps: { label: string; href: string; done: boolean }[] = [
    { label: t("steps.date"), href: "/app/settings", done: !!wedding.wedding_date },
    { label: t("steps.location"), href: "/app/settings", done: !!wedding.location },
    {
      label: t("steps.invite"),
      href: "/app/settings#collaborators",
      done: (memberCount ?? 1) > 1,
    },
    {
      label: guestCount ? t("steps.guestsSoFar", { count: guestCount }) : t("steps.guests"),
      href: "/app/guests",
      done: (guestCount ?? 0) > 0,
    },
    { label: t("steps.budget"), href: "/app/budget", done: wedding.budget_total != null },
    { label: t("steps.shortlist"), href: "/app/venues", done: venues.total > 0 },
    { label: t("steps.book"), href: "/app/venues", done: venues.booked > 0 },
    { label: t("steps.inspiration"), href: "/app/inspiration", done: inspiration.pins.length > 0 },
    { label: t("steps.website"), href: "/app/website", done: website.published },
    { label: t("steps.timeline"), href: "/app/tasks", done: tasks.total > 0 },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <div className="space-y-10">
      {welcome && (
        <div role="status" className="bg-blush/60 rounded-lg px-6 py-5">
          <p className="font-script text-4xl leading-tight">{t("welcome")}</p>
          <p className="text-muted-foreground text-sm">{t("welcomeText")}</p>
        </div>
      )}

      {/* Countdown hero: a soft photo-style backdrop with an overlapping card */}
      <section className="relative lg:min-h-[22rem]">
        <div
          aria-hidden
          className="soft-photo h-44 rounded-lg sm:h-56 lg:absolute lg:inset-y-0 lg:start-0 lg:h-auto lg:w-3/5"
        />
        <div className="bg-card relative mx-3 -mt-16 rounded-md border p-6 sm:mx-8 sm:p-10 lg:ms-auto lg:me-0 lg:mt-10 lg:w-[58%]">
          <div>
            <h1 className="font-script text-5xl leading-tight font-normal sm:text-6xl">
              {coupleName(wedding)}
            </h1>
            <p className="caps text-muted-foreground mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>
                {wedding.wedding_date ? fmtDate(wedding.wedding_date, locale, "full") : t("noDate")}
              </span>
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
                      <CalendarPlus aria-hidden /> {t("setDate")}
                    </Link>
                  </Button>
                )
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Next steps */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="font-serif text-2xl">{t("nextSteps")}</CardTitle>
            <p className="text-muted-foreground text-sm">
              {t("stepsDone", { done: doneCount, total: steps.length })}
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
                    <span className="sr-only">{s.done ? t("done") : t("toDo")}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Module summaries */}
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
          <SummaryCard
            icon={Wallet}
            title={t("budget.title")}
            empty={t("budget.empty")}
            href="/app/budget"
            cta={t("budget.cta")}
          >
            {(budget.summary.total != null || budget.summary.totals.committed > 0) && (
              <div className="space-y-3">
                <p className="text-sm">
                  <span className="font-serif text-3xl font-medium tabular-nums">
                    {money(budget.summary.totals.committed)}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    {budget.summary.total != null
                      ? t("budget.committedOf", { total: money(budget.summary.total) })
                      : t("budget.committed")}
                  </span>
                </p>
                {budget.summary.total != null && budget.summary.total > 0 && (
                  <div className="bg-muted h-2 rounded-full">
                    <div
                      className={cn(
                        "h-2 rounded-full",
                        budget.summary.totals.committed > budget.summary.total
                          ? "bg-destructive"
                          : "bg-primary",
                      )}
                      style={{
                        width: `${Math.min(100, (budget.summary.totals.committed / budget.summary.total) * 100)}%`,
                      }}
                    />
                  </div>
                )}
                {budget.upcoming.length > 0 && (
                  <ul className="space-y-1 text-xs">
                    {budget.upcoming.slice(0, 3).map((p) => (
                      <li
                        key={p.id}
                        className={cn(
                          "flex justify-between gap-2",
                          p.overdue && "text-destructive",
                        )}
                      >
                        <span className="truncate">
                          {p.overdue ? t("budget.overdue", { name: p.expenseName }) : p.expenseName}
                        </span>
                        <span className="shrink-0 tabular-nums">
                          {money(p.amount)}
                          {p.dueDate ? ` · ${shortDate(p.dueDate)}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </SummaryCard>
          <SummaryCard
            icon={MailCheck}
            title={t("rsvp.title")}
            empty={t("rsvp.empty")}
            href="/app/rsvp"
            cta={t("rsvp.cta")}
          >
            {rsvp.invited > 0 && (
              <dl className="grid grid-cols-3 gap-2 text-center">
                {(
                  [
                    [t("rsvp.attending"), rsvp.attending],
                    [t("rsvp.declined"), rsvp.declined],
                    [t("rsvp.waiting"), rsvp.waiting],
                  ] as const
                ).map(([label, n]) => (
                  <div key={label} className="bg-muted rounded-lg p-2">
                    <dd className="font-serif text-3xl font-medium tabular-nums">{n}</dd>
                    <dt className="text-muted-foreground text-xs">{label}</dt>
                  </div>
                ))}
              </dl>
            )}
          </SummaryCard>
          <SummaryCard
            icon={Armchair}
            title={t("seating.title")}
            empty={t("seating.empty")}
            href="/app/seating"
            cta={t("seating.cta")}
          >
            {seating.tables > 0 && (
              <div className="space-y-2">
                <p className="text-sm">
                  <span className="font-serif text-3xl font-medium tabular-nums">
                    {seating.seated}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    {t("seating.seated", { attending: rsvp.attending, tables: seating.tables })}
                  </span>
                </p>
                <div className="bg-muted h-2 rounded-full">
                  <div
                    className="bg-primary h-2 rounded-full"
                    style={{
                      width: `${rsvp.attending ? Math.min(100, (seating.seated / rsvp.attending) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </SummaryCard>
          <SummaryCard
            icon={Lightbulb}
            title={t("inspiration.title")}
            empty={t("inspiration.empty")}
            href="/app/inspiration"
            cta={t("inspiration.cta")}
          >
            {inspiration.pins.length > 0 && (
              <div className="space-y-3">
                <ul className="grid grid-cols-3 gap-2">
                  {inspiration.pins.map((p) => (
                    <li key={p.id} className="overflow-hidden rounded-lg">
                      <PinImage
                        src={p.src}
                        alt={p.title || t("inspiration.pin")}
                        width={1}
                        height={1}
                        size={240}
                      />
                    </li>
                  ))}
                </ul>
                <PaletteStrip colors={inspiration.palette} canEdit={false} size="sm" />
              </div>
            )}
          </SummaryCard>
          <SummaryCard
            icon={ListChecks}
            title={t("tasks.title")}
            empty={t("tasks.empty")}
            href="/app/tasks"
            cta={t("tasks.cta")}
          >
            {tasks.total > 0 && (
              <div className="space-y-3">
                <p className="text-sm">
                  <span className="font-serif text-3xl font-medium tabular-nums">{tasks.done}</span>{" "}
                  <span className="text-muted-foreground">
                    {t("tasks.ofDone", { total: tasks.total })}
                  </span>
                  {tasks.overdue > 0 && (
                    <span className="text-destructive">
                      {" "}
                      · {t("tasks.overdue", { count: tasks.overdue })}
                    </span>
                  )}
                </p>
                <div className="bg-muted h-2 rounded-full">
                  <div
                    className="bg-primary h-2 rounded-full"
                    style={{ width: `${(tasks.done / tasks.total) * 100}%` }}
                  />
                </div>
                {tasks.next.length > 0 && (
                  <ul className="space-y-1 text-xs">
                    {tasks.next.map((task) => (
                      <li
                        key={task.id}
                        className={cn(
                          "flex justify-between gap-2",
                          task.due_date && task.due_date < today && "text-destructive",
                        )}
                      >
                        <Link
                          href={`/app/tasks?task=${task.id}`}
                          className="truncate hover:underline"
                        >
                          {task.title}
                        </Link>
                        {task.due_date && (
                          <span className="shrink-0 tabular-nums">{shortDate(task.due_date)}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </SummaryCard>
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
        <span className="bg-primary-soft text-primary-ink inline-flex size-9 items-center justify-center rounded-full">
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

/** Done / total, overdue count and the next few open to-dos. */
async function tasksSummary(supabase: Awaited<ReturnType<typeof createClient>>, weddingId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const head = { count: "exact" as const, head: true };
  const [{ count: total }, { count: done }, { count: overdue }, { data: next }] = await Promise.all(
    [
      supabase.from("tasks").select("id", head).eq("wedding_id", weddingId),
      supabase.from("tasks").select("id", head).eq("wedding_id", weddingId).eq("done", true),
      supabase
        .from("tasks")
        .select("id", head)
        .eq("wedding_id", weddingId)
        .eq("done", false)
        .lt("due_date", today),
      supabase
        .from("tasks")
        .select("id, title, due_date")
        .eq("wedding_id", weddingId)
        .eq("done", false)
        .order("due_date", { nullsFirst: false })
        .limit(3),
    ],
  );
  // suggested to-dos nobody has renamed are shown in the viewer's language
  const shown = await starterTexts(await getLocale());
  return {
    total: total ?? 0,
    done: done ?? 0,
    overdue: overdue ?? 0,
    next: (next ?? []).map((task) => ({ ...task, title: shown(task.title, "tasks.suggestions") })),
  };
}

/** The newest pins (with temporary links for uploads) and the palette. */
async function inspirationSummary(
  supabase: Awaited<ReturnType<typeof createClient>>,
  weddingId: string,
) {
  const [{ data: pins }, { data: palette }] = await Promise.all([
    supabase
      .from("pins")
      .select("id, title, image_path, image_url")
      .eq("wedding_id", weddingId)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("palette_colors")
      .select("id, hex")
      .eq("wedding_id", weddingId)
      .order("sort_order"),
  ]);
  const signed = await signPaths(
    supabase,
    (pins ?? []).map((p) => p.image_path).filter((p): p is string => !!p),
  );
  return {
    pins: (pins ?? []).map((p) => ({
      ...p,
      src: p.image_path ? (signed.get(p.image_path) ?? null) : p.image_url,
    })),
    palette: palette ?? [],
  };
}

/** Tables and seated guests across the wedding's seating charts. */
async function seatingSummary(
  supabase: Awaited<ReturnType<typeof createClient>>,
  weddingId: string,
) {
  const [{ count: tables }, { count: seated }] = await Promise.all([
    supabase
      .from("seating_objects")
      .select("id", { count: "exact", head: true })
      .eq("wedding_id", weddingId)
      .in("kind", ["round", "rect", "square", "head", "sweetheart"]),
    supabase
      .from("seat_assignments")
      .select("guest_id", { count: "exact", head: true })
      .eq("wedding_id", weddingId),
  ]);
  return { tables: tables ?? 0, seated: seated ?? 0 };
}
