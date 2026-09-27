"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDistanceToNowStrict, parseISO } from "date-fns";
import {
  Check,
  Copy,
  ExternalLink,
  MailOpen,
  MailWarning,
  MessageCircle,
  MoreHorizontal,
  Music,
  PenLine,
  Search,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { normalize } from "@/lib/guests/filter";
import type { DashboardHousehold, RsvpDashboardData } from "@/lib/rsvp/load";
import { cn } from "@/lib/utils";
import type { RsvpSettingsValues } from "@/lib/validation/rsvp";
import { RecordReplyDialog } from "./record-reply-dialog";
import { RsvpSetup } from "./rsvp-setup";
import { SendEmailDialog } from "./send-email-dialog";

type Filter = "all" | "waiting" | "replied" | "partial" | "not_emailed";

type Props = {
  data: RsvpDashboardData;
  /** the wedding's languages, main first */
  languages: string[];
  settings: RsvpSettingsValues;
  siteUrl: string;
  slug: string;
  couple: string;
  emailConfigured: boolean;
  adminConfigured: boolean;
  canEdit: boolean;
  focusHouseholdId?: string;
};

async function copy(text: string, what = "Link") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied`);
  } catch {
    toast.error("Couldn't copy automatically. Please copy it by hand.");
  }
}

export function RsvpDashboard(props: Props) {
  const { data, siteUrl, slug, canEdit, emailConfigured } = props;
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [emailing, setEmailing] = useState<{
    ids: string[];
    kind: "invitation" | "reminder";
  } | null>(null);
  const [recording, setRecording] = useState<{ name: string; code: string } | null>(null);
  const closeRecording = useCallback(() => setRecording(null), []);

  // Opened from a notification link (?household=…): show that household's answers.
  useEffect(() => {
    const h = data.households.find((x) => x.id === props.focusHouseholdId);
    if (h && canEdit) setRecording({ name: h.name, code: h.code });
    // only on first load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const invited = data.households.filter((h) => h.reply.status !== "not_invited");
  const counts = {
    all: invited.length,
    waiting: invited.filter((h) => h.reply.status === "waiting").length,
    partial: invited.filter((h) => h.reply.status === "partial").length,
    replied: invited.filter((h) => h.reply.status === "replied").length,
    not_emailed: invited.filter((h) => !h.lastEmail).length,
  };

  const visible = useMemo(() => {
    const words = normalize(search).split(/\s+/).filter(Boolean);
    return invited.filter((h) => {
      if (filter === "not_emailed" ? !!h.lastEmail : filter !== "all" && h.reply.status !== filter)
        return false;
      const hay = normalize([h.name, ...h.guests.map((g) => g.name)].join(" "));
      return words.every((w) => hay.includes(w));
    });
  }, [invited, filter, search]);

  const selectedIds = visible.filter((h) => selected.has(h.id)).map((h) => h.id);
  const targets = (ids: string[]) =>
    data.households
      .filter((h) => ids.includes(h.id))
      .map((h) => ({
        id: h.id,
        name: h.name,
        hasEmail: h.guests.some((g) => g.email && !g.isPlusOne),
      }));

  const publicUrl = `${siteUrl}/rsvp/${slug}`;
  const messages = data.households.filter((h) => h.message || h.songRequest);

  return (
    <>
      <PageHeader
        title="RSVPs"
        description="Who's coming, who hasn't replied yet, and what everyone is eating."
        actions={
          canEdit && (
            <>
              <Button variant="outline" size="sm" onClick={() => copy(publicUrl, "RSVP page link")}>
                <Copy aria-hidden /> Copy RSVP page link
              </Button>
              <Button
                size="sm"
                disabled={counts.waiting + counts.partial === 0}
                onClick={() =>
                  setEmailing({
                    ids: invited.filter((h) => h.reply.status !== "replied").map((h) => h.id),
                    kind: counts.not_emailed === counts.all ? "invitation" : "reminder",
                  })
                }
              >
                <Send aria-hidden /> Email everyone who hasn&apos;t replied
              </Button>
            </>
          )
        }
      />

      <Tabs defaultValue="replies" className="gap-6">
        <TabsList>
          <TabsTrigger value="replies">Replies</TabsTrigger>
          <TabsTrigger value="setup">Meals &amp; settings</TabsTrigger>
        </TabsList>

        <TabsContent value="replies" className="space-y-6">
          {data.events.length === 0 || invited.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <h2 className="text-3xl">Nothing to RSVP for yet</h2>
                <p className="text-muted-foreground mx-auto mt-2 max-w-md">
                  Add guests and invite them to your events on the Guests page. Each household then
                  gets its own private RSVP link.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <EventTotalsGrid data={data} />
              <MealCountsCard data={data} />

              {/* ---------- households ---------- */}
              <Card>
                <CardHeader className="gap-4">
                  <CardTitle className="font-serif text-2xl">Households</CardTitle>
                  <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <div className="relative flex-1">
                      <Search
                        className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                        aria-hidden
                      />
                      <Input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search households or names…"
                        aria-label="Search households"
                        className="pl-9"
                      />
                    </div>
                    <div role="radiogroup" aria-label="Show" className="flex flex-wrap gap-1.5">
                      {(
                        [
                          ["all", "All"],
                          ["waiting", "Not replied"],
                          ["partial", "Partly"],
                          ["replied", "Replied"],
                          ["not_emailed", "Not emailed"],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          role="radio"
                          aria-checked={filter === value}
                          onClick={() => setFilter(value)}
                          className={cn(
                            "focus-visible:ring-ring rounded-full border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:outline-none",
                            filter === value
                              ? "border-primary bg-primary-soft font-medium"
                              : "hover:bg-accent",
                          )}
                        >
                          {label}{" "}
                          <span className="text-muted-foreground tabular-nums">
                            {counts[value]}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {canEdit && visible.length > 0 && (
                    <div className="mb-2 flex flex-wrap items-center gap-2 px-1">
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={
                            selectedIds.length === 0
                              ? false
                              : selectedIds.length === visible.length
                                ? true
                                : "indeterminate"
                          }
                          onCheckedChange={(c) =>
                            setSelected(c === true ? new Set(visible.map((h) => h.id)) : new Set())
                          }
                        />
                        Select all shown
                      </label>
                      {selectedIds.length > 0 && (
                        <div className="ml-auto flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEmailing({ ids: selectedIds, kind: "invitation" })}
                          >
                            <Send aria-hidden /> Send invitation ({selectedIds.length})
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEmailing({ ids: selectedIds, kind: "reminder" })}
                          >
                            <Send aria-hidden /> Send reminder
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                  {visible.length === 0 ? (
                    <p className="text-muted-foreground py-8 text-center text-sm">
                      No households match.
                    </p>
                  ) : (
                    <ul className="divide-y rounded-lg border">
                      {visible.map((h) => (
                        <HouseholdRow
                          key={h.id}
                          household={h}
                          link={`${siteUrl}/r/${h.code}`}
                          couple={props.couple}
                          canEdit={canEdit}
                          selected={selected.has(h.id)}
                          onSelect={(on) =>
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (on) next.add(h.id);
                              else next.delete(h.id);
                              return next;
                            })
                          }
                          onRecord={() => setRecording({ name: h.name, code: h.code })}
                          onRemind={() =>
                            setEmailing({
                              ids: [h.id],
                              kind: h.lastEmail ? "reminder" : "invitation",
                            })
                          }
                        />
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              {messages.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="font-serif text-2xl">
                      Messages &amp; song requests
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-4">
                      {messages.map((h) => (
                        <li key={h.id} className="border-primary/40 border-l-2 pl-4">
                          <p className="text-sm font-medium">{h.name}</p>
                          {h.message && (
                            <p className="text-muted-foreground text-sm whitespace-pre-line">
                              “{h.message}”
                            </p>
                          )}
                          {h.songRequest && (
                            <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-sm">
                              <Music className="size-3.5" aria-hidden /> {h.songRequest}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="setup">
          <RsvpSetup
            settings={props.settings}
            mealOptions={data.mealOptions}
            events={data.events}
            adminConfigured={props.adminConfigured}
            emailConfigured={emailConfigured}
            readOnly={!canEdit}
            languages={props.languages}
          />
        </TabsContent>
      </Tabs>

      <SendEmailDialog
        open={!!emailing}
        onOpenChange={(o) => !o && setEmailing(null)}
        households={emailing ? targets(emailing.ids) : []}
        emailConfigured={emailConfigured}
        defaultKind={emailing?.kind}
        onSent={() => setSelected(new Set())}
      />
      <RecordReplyDialog household={recording} onClose={closeRecording} />
    </>
  );
}

function EventTotalsGrid({ data }: { data: RsvpDashboardData }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {data.events.map((e) => {
        const t = data.totals[e.id];
        if (!t || t.invited === 0) return null;
        const pct = (n: number) => `${(n / t.invited) * 100}%`;
        return (
          <Card key={e.id}>
            <CardContent className="space-y-3 p-5">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {e.name}
              </p>
              <p>
                <span className="font-serif text-5xl font-semibold tabular-nums">
                  {t.attending}
                </span>{" "}
                <span className="text-muted-foreground">attending of {t.invited}</span>
              </p>
              <div className="bg-muted flex h-2 overflow-hidden rounded-full" aria-hidden>
                <div className="bg-primary" style={{ width: pct(t.attending) }} />
                <div className="bg-foreground/25" style={{ width: pct(t.declined) }} />
              </div>
              <p className="text-muted-foreground flex flex-wrap gap-x-4 text-sm">
                <span>{t.declined} declined</span>
                <span className={cn(t.waiting > 0 && "text-foreground font-medium")}>
                  {t.waiting} waiting
                </span>
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function MealCountsCard({ data }: { data: RsvpDashboardData }) {
  const mealEvents = data.events.filter((e) => e.mealChoice && data.meals[e.id]);
  if (mealEvents.length === 0 || data.mealOptions.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-2xl">Meals for the caterer</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 sm:grid-cols-2">
        {mealEvents.map((e) => {
          const c = data.meals[e.id];
          return (
            <div key={e.id}>
              <p className="mb-2 text-sm font-medium">{e.name}</p>
              <dl className="divide-y rounded-lg border text-sm">
                {data.mealOptions.map((m) => (
                  <div key={m.id} className="flex justify-between px-3 py-2">
                    <dt>{m.name}</dt>
                    <dd className="font-medium tabular-nums">{c.byMeal[m.id] ?? 0}</dd>
                  </div>
                ))}
                {c.noChoice > 0 && (
                  <div className="text-warning flex justify-between px-3 py-2">
                    <dt>Attending, no meal chosen</dt>
                    <dd className="font-medium tabular-nums">{c.noChoice}</dd>
                  </div>
                )}
              </dl>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

const STATUS_BADGE: Record<
  DashboardHousehold["reply"]["status"],
  { label: string; className: string }
> = {
  replied: {
    label: "Replied",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  },
  partial: {
    label: "Partly replied",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  },
  waiting: { label: "Not replied", className: "bg-muted text-muted-foreground" },
  not_invited: { label: "Not invited", className: "bg-muted text-muted-foreground" },
};

function HouseholdRow({
  household: h,
  link,
  couple,
  canEdit,
  selected,
  onSelect,
  onRecord,
  onRemind,
}: {
  household: DashboardHousehold;
  link: string;
  couple: string;
  canEdit: boolean;
  selected: boolean;
  onSelect: (on: boolean) => void;
  onRecord: () => void;
  onRemind: () => void;
}) {
  const badge = STATUS_BADGE[h.reply.status];
  const hasEmail = h.guests.some((g) => g.email && !g.isPlusOne);
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(
    `Hi ${h.name}! Please RSVP for ${couple}'s wedding here: ${link}`,
  )}`;

  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 p-3",
        selected && "bg-primary-soft/50",
      )}
    >
      {canEdit && (
        <Checkbox
          checked={selected}
          onCheckedChange={(c) => onSelect(c === true)}
          aria-label={`Select ${h.name}`}
        />
      )}
      <div className="min-w-48 flex-1">
        <p className="font-medium">{h.name}</p>
        <p className="text-muted-foreground truncate text-xs">
          {h.guests.map((g) => g.name).join(", ")}
        </p>
      </div>

      <div className="flex min-w-40 flex-col gap-1">
        <Badge className={cn("border-0", badge.className)}>
          {h.reply.status === "replied" && <Check aria-hidden />}
          {badge.label}
        </Badge>
        {h.reply.status !== "waiting" && (
          <span className="text-muted-foreground text-xs">
            {h.reply.attending} coming · {h.reply.declined} not
          </span>
        )}
      </div>

      <div className="text-muted-foreground min-w-36 text-xs">
        {h.lastEmail ? (
          <span className="inline-flex items-center gap-1">
            {h.lastEmail.status === "opened" ? (
              <MailOpen className="text-success size-3.5" aria-hidden />
            ) : h.lastEmail.status === "bounced" || h.lastEmail.status === "failed" ? (
              <MailWarning className="text-destructive size-3.5" aria-hidden />
            ) : (
              <Send className="size-3.5" aria-hidden />
            )}
            {h.lastEmail.kind === "invitation" ? "Invited" : "Reminded"}{" "}
            {formatDistanceToNowStrict(parseISO(h.lastEmail.sentAt), { addSuffix: true })}
            {h.lastEmail.status === "opened" && " · opened"}
            {h.lastEmail.status === "bounced" && " · bounced"}
            {h.lastEmail.status === "failed" && " · failed"}
          </span>
        ) : hasEmail ? (
          "Not emailed yet"
        ) : (
          "No email address"
        )}
      </div>

      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => copy(link)}
          aria-label={`Copy RSVP link for ${h.name}`}
        >
          <Copy aria-hidden />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${h.name}`}>
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => copy(link)}>
              <Copy aria-hidden /> Copy RSVP link
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={whatsapp} target="_blank" rel="noreferrer">
                <MessageCircle aria-hidden /> Share on WhatsApp
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={link} target="_blank" rel="noreferrer">
                <ExternalLink aria-hidden /> Open their RSVP page
              </a>
            </DropdownMenuItem>
            {canEdit && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onRecord}>
                  <PenLine aria-hidden /> Record or edit their reply
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onRemind} disabled={!hasEmail}>
                  <Send aria-hidden /> {h.lastEmail ? "Send reminder" : "Send invitation"}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
