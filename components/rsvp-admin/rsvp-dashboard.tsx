"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useLocale, useTranslations } from "next-intl";
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
import { relative } from "@/lib/i18n/format";
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

function useCopy() {
  const t = useTranslations("rsvpAdmin");
  return async (text: string, done = t("linkCopied")) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(done);
    } catch {
      toast.error(t("copyFailed"));
    }
  };
}

export function RsvpDashboard(props: Props) {
  const { data, siteUrl, slug, canEdit, emailConfigured } = props;
  const t = useTranslations("rsvpAdmin");
  const copy = useCopy();
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
        title={t("title")}
        description={t("description")}
        actions={
          canEdit && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copy(publicUrl, t("pageLinkCopied"))}
              >
                <Copy aria-hidden /> {t("copyPage")}
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
                <Send aria-hidden /> {t("emailWaiting")}
              </Button>
            </>
          )
        }
      />

      <Tabs defaultValue="replies" className="gap-6">
        <TabsList>
          <TabsTrigger value="replies">{t("tabReplies")}</TabsTrigger>
          <TabsTrigger value="setup">{t("tabSetup")}</TabsTrigger>
        </TabsList>

        <TabsContent value="replies" className="space-y-6">
          {data.events.length === 0 || invited.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <h2 className="text-3xl">{t("nothingTitle")}</h2>
                <p className="text-muted-foreground mx-auto mt-2 max-w-md">{t("nothingText")}</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <EventTotalsGrid data={data} />
              <MealCountsCard data={data} />

              {/* ---------- households ---------- */}
              <Card>
                <CardHeader className="gap-4">
                  <CardTitle className="font-serif text-2xl">{t("households")}</CardTitle>
                  <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <div className="relative flex-1">
                      <Search
                        className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2"
                        aria-hidden
                      />
                      <Input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t("search")}
                        aria-label={t("searchLabel")}
                        className="ps-9"
                      />
                    </div>
                    <div
                      role="radiogroup"
                      aria-label={t("show")}
                      className="flex flex-wrap gap-1.5"
                    >
                      {(["all", "waiting", "partial", "replied", "not_emailed"] as const).map(
                        (value) => (
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
                            {t(`filters.${value}`)}{" "}
                            <span className="text-muted-foreground tabular-nums">
                              {counts[value]}
                            </span>
                          </button>
                        ),
                      )}
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
                        {t("selectAll")}
                      </label>
                      {selectedIds.length > 0 && (
                        <div className="ms-auto flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEmailing({ ids: selectedIds, kind: "invitation" })}
                          >
                            <Send aria-hidden />{" "}
                            {t("sendInvitationCount", { count: selectedIds.length })}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEmailing({ ids: selectedIds, kind: "reminder" })}
                          >
                            <Send aria-hidden /> {t("sendReminder")}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                  {visible.length === 0 ? (
                    <p className="text-muted-foreground py-8 text-center text-sm">{t("noMatch")}</p>
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
                    <CardTitle className="font-serif text-2xl">{t("messages")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-4">
                      {messages.map((h) => (
                        <li key={h.id} className="border-primary/40 border-s-2 ps-4">
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
  const tr = useTranslations("rsvpAdmin");
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
                <span className="font-serif text-5xl font-medium tabular-nums">{t.attending}</span>{" "}
                <span className="text-muted-foreground">
                  {tr("attendingOf", { invited: t.invited })}
                </span>
              </p>
              <div className="bg-muted flex h-2 overflow-hidden rounded-full" aria-hidden>
                <div className="bg-primary" style={{ width: pct(t.attending) }} />
                <div className="bg-foreground/25" style={{ width: pct(t.declined) }} />
              </div>
              <p className="text-muted-foreground flex flex-wrap gap-x-4 text-sm">
                <span>{tr("declined", { count: t.declined })}</span>
                <span className={cn(t.waiting > 0 && "text-foreground font-medium")}>
                  {tr("waiting", { count: t.waiting })}
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
  const t = useTranslations("rsvpAdmin");
  if (mealEvents.length === 0 || data.mealOptions.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-2xl">{t("mealsTitle")}</CardTitle>
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
                    <dt>{t("noMeal")}</dt>
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

const STATUS_BADGE: Record<DashboardHousehold["reply"]["status"], string> = {
  replied: "bg-tint-sage text-tint-sage-fg",
  partial: "bg-tint-sand text-tint-sand-fg",
  waiting: "bg-muted text-muted-foreground",
  not_invited: "bg-muted text-muted-foreground",
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
  const t = useTranslations("rsvpAdmin");
  const locale = useLocale();
  const copy = useCopy();
  const hasEmail = h.guests.some((g) => g.email && !g.isPlusOne);
  const guestPhone = h.guests.find((g) => g.phone)?.phone;
  const waText = encodeURIComponent(t("whatsappText", { name: h.name, couple, link }));
  const whatsapp = guestPhone
    ? `https://wa.me/${guestPhone.replace(/\D/g, "")}?text=${waText}`
    : `https://wa.me/?text=${waText}`;

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
          aria-label={t("select", { name: h.name })}
        />
      )}
      <div className="min-w-48 flex-1">
        <p className="font-medium">{h.name}</p>
        <p className="text-muted-foreground truncate text-xs">
          {h.guests.map((g) => g.name).join(", ")}
        </p>
      </div>

      <div className="flex min-w-40 flex-col gap-1">
        <Badge className={cn("border-0", STATUS_BADGE[h.reply.status])}>
          {h.reply.status === "replied" && <Check aria-hidden />}
          {t(`status.${h.reply.status}`)}
        </Badge>
        {h.reply.status !== "waiting" && (
          <span className="text-muted-foreground text-xs">
            {t("comingNot", { attending: h.reply.attending, declined: h.reply.declined })}
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
            {t(h.lastEmail.kind === "invitation" ? "invited" : "reminded", {
              when: relative(h.lastEmail.sentAt, locale),
            })}
            {h.lastEmail.status === "opened" && t("opened")}
            {h.lastEmail.status === "bounced" && t("bounced")}
            {h.lastEmail.status === "failed" && t("failed")}
          </span>
        ) : hasEmail ? (
          t("notEmailed")
        ) : (
          t("noEmail")
        )}
      </div>

      <div className="ms-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => copy(link)}
          aria-label={t("copyFor", { name: h.name })}
        >
          <Copy aria-hidden />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t("moreFor", { name: h.name })}>
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => copy(link)}>
              <Copy aria-hidden /> {t("copyLink")}
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={whatsapp} target="_blank" rel="noreferrer">
                <MessageCircle aria-hidden /> {t("whatsapp")}
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={link} target="_blank" rel="noreferrer">
                <ExternalLink aria-hidden /> {t("open")}
              </a>
            </DropdownMenuItem>
            {canEdit && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onRecord}>
                  <PenLine aria-hidden /> {t("record")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onRemind} disabled={!hasEmail}>
                  <Send aria-hidden /> {h.lastEmail ? t("sendReminder") : t("sendInvitation")}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
