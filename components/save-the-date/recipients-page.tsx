"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Copy,
  Download,
  ExternalLink,
  Filter,
  Mail,
  MessageSquare,
  Phone,
  Search,
  XCircle,
} from "lucide-react";
import {
  ensureRecipientSends,
  exportRecipientsCsv,
  loadRecipients,
  sendSaveTheDateSms,
  sendSaveTheDates,
  updateSendMethod,
  type RecipientRow,
  type RecipientSummary,
} from "@/app/app/save-the-date/recipients/actions";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { StdSendMethod } from "@/lib/database.types";
import { whatsappDirectUrl } from "@/lib/trip/whatsapp";
import { cn } from "@/lib/utils";

type Props = {
  stdId: string;
  published: boolean;
  siteUrl: string;
  couple: string;
};

export function RecipientsPage({ stdId, published, siteUrl, couple }: Props) {
  const t = useTranslations("app.saveTheDate");
  const [pending, start] = useTransition();
  const [recipients, setRecipients] = useState<RecipientRow[]>([]);
  const [summary, setSummary] = useState<RecipientSummary | null>(null);
  const [events, setEvents] = useState<{ id: string; name: string }[]>([]);
  const [tags, setTags] = useState<{ id: string; name: string }[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [filterEvent, setFilterEvent] = useState<string>("all");
  const [filterTag, setFilterTag] = useState<string>("all");
  const [filterSide, setFilterSide] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [hideDeclined, setHideDeclined] = useState(true);

  const refresh = useCallback(() => {
    start(async () => {
      const ensureResult = await ensureRecipientSends(stdId);
      if (!ensureResult.ok) {
        toast.error(ensureResult.error);
        return;
      }
      const r = await loadRecipients();
      if (r.ok) {
        setRecipients(r.data.recipients);
        setSummary(r.data.summary);
        setEvents(r.data.events);
        setTags(r.data.tags);
        setLoaded(true);
      } else {
        toast.error(r.error);
      }
    });
  }, [stdId]);

  useEffect(() => { refresh(); }, [refresh]);

  const filtered = useMemo(() => {
    let list = recipients;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.householdName.toLowerCase().includes(q) ||
          r.guestNames.some((n) => n.toLowerCase().includes(q)) ||
          r.emails.some((e) => e.includes(q)),
      );
    }
    if (filterEvent !== "all") {
      list = list.filter((r) => r.events.includes(filterEvent));
    }
    if (filterTag !== "all") {
      list = list.filter((r) => r.tags.includes(filterTag));
    }
    if (filterSide !== "all") {
      list = list.filter((r) => r.side === filterSide);
    }
    if (filterStatus === "not_sent") {
      list = list.filter((r) => r.status === "not_sent");
    } else if (filterStatus === "sent") {
      list = list.filter((r) => r.status !== "not_sent");
    } else if (filterStatus === "no_contact") {
      list = list.filter((r) => !r.method);
    }
    if (hideDeclined) {
      list = list.filter((r) => !r.declined);
    }
    return list;
  }, [recipients, search, filterEvent, filterTag, filterSide, filterStatus, hideDeclined]);

  function handleMethodChange(r: RecipientRow, method: string) {
    if (!r.sendId) return;
    const m = method === "none" ? null : (method as StdSendMethod);
    start(async () => {
      const result = await updateSendMethod(r.sendId!, m);
      if (result.ok) {
        setRecipients((prev) =>
          prev.map((row) =>
            row.householdId === r.householdId
              ? { ...row, method: m, methodOverride: true }
              : row,
          ),
        );
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleExportCsv() {
    start(async () => {
      const r = await exportRecipientsCsv();
      if (r.ok) {
        const blob = new Blob([r.data], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "save-the-date-recipients.csv";
        a.click();
        URL.revokeObjectURL(url);
        toast.success(t("csvExported"));
      } else {
        toast.error(r.error);
      }
    });
  }

  function handleCopyLink(r: RecipientRow) {
    if (!r.token) return;
    const link = `${siteUrl}/s/${r.token}`;
    navigator.clipboard.writeText(link);
    toast.success(t("linkCopied"));
  }

  function handleWhatsApp(r: RecipientRow) {
    if (!r.token || r.phones.length === 0) return;
    const link = `${siteUrl}/s/${r.token}`;
    const text = `${couple} — Save the Date! ${link}`;
    window.open(whatsappDirectUrl(r.phones[0], text), "_blank");
  }

  // Send state
  const [showConfirm, setShowConfirm] = useState<"email" | "sms" | null>(null);
  const [sending, setSending] = useState(false);

  const emailCount = recipients.filter(
    (r) => r.method === "email" && r.status === "not_sent" && !r.declined,
  ).length;
  const smsCount = recipients.filter(
    (r) => r.method === "sms" && r.status === "not_sent" && !r.declined,
  ).length;

  function handleSendEmails() {
    if (!published) { toast.error(t("mustPublish")); return; }
    if (emailCount === 0) return;
    setShowConfirm("email");
  }

  function handleSendSms() {
    if (!published) { toast.error(t("mustPublish")); return; }
    if (smsCount === 0) return;
    setShowConfirm("sms");
  }

  async function confirmSend() {
    const mode = showConfirm;
    setShowConfirm(null);
    setSending(true);
    if (mode === "email") {
      const result = await sendSaveTheDates(stdId);
      setSending(false);
      if (result.ok) {
        const { sent, failed, noEmail } = result.data;
        if (sent > 0 || failed > 0) toast.success(t("sendComplete", { sent, failed }));
        if (noEmail.length > 0) toast(t("sendNoEmail", { count: noEmail.length }));
        refresh();
      } else {
        toast.error(result.error);
      }
    } else {
      const result = await sendSaveTheDateSms(stdId);
      setSending(false);
      if (result.ok) {
        const { sent, failed, noPhone } = result.data;
        if (sent > 0 || failed > 0) toast.success(t("sendComplete", { sent, failed }));
        if (noPhone.length > 0) toast(t("sendNoPhone", { count: noPhone.length }));
        refresh();
      } else {
        toast.error(result.error);
      }
    }
  }

  const noContact = recipients.filter((r) => !r.method && !r.declined);
  const problems = recipients.filter((r) => r.error);

  if (!loaded) {
    return (
      <>
        <PageHeader title={t("recipientsTitle")} />
        <div className="flex items-center justify-center py-20">
          <div className="text-muted-foreground text-sm">{t("loading")}</div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t("recipientsTitle")}
        description={t("recipientsDescription")}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/app/save-the-date">
                <ArrowLeft className="mr-1.5 size-4" />
                {t("backToDesign")}
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={pending}>
              <Download className="mr-1.5 size-4" />
              CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSendSms}
              disabled={pending || sending || smsCount === 0}
            >
              <Phone className="mr-1.5 size-4" />
              {t("sendAllSms")} ({smsCount})
            </Button>
            <Button
              size="sm"
              onClick={handleSendEmails}
              disabled={pending || sending || emailCount === 0}
            >
              <Mail className="mr-1.5 size-4" />
              {sending ? t("sendingProgress", { sent: "…", total: emailCount + smsCount }) : `${t("sendAllEmails")} (${emailCount})`}
            </Button>
          </div>
        }
      />

      {/* Summary cards */}
      {summary && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <SummaryCard label={t("summaryTotal")} value={summary.total} />
          <SummaryCard label={t("summaryEmail")} value={summary.byEmail} icon={<Mail className="size-4" />} />
          <SummaryCard label={t("summarySms")} value={summary.bySms} icon={<Phone className="size-4" />} />
          <SummaryCard label={t("summaryNoContact")} value={summary.noContact} warn={summary.noContact > 0} />
          <SummaryCard label={t("summarySent")} value={summary.alreadySent} />
          <SummaryCard label={t("summaryDeclined")} value={summary.declined} />
        </div>
      )}

      {/* Problems */}
      {(noContact.length > 0 || problems.length > 0) && (
        <Card className="border-warning/50 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="text-warning size-4" />
              {t("problems")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {noContact.length > 0 && (
              <p className="text-sm">
                <span className="font-medium">{t("noContactCount", { count: noContact.length })}</span>
                {": "}
                {noContact
                  .slice(0, 5)
                  .map((r) => r.householdName)
                  .join(", ")}
                {noContact.length > 5 && ` +${noContact.length - 5}`}
              </p>
            )}
            {problems.map((r) => (
              <p key={r.householdId} className="text-destructive text-sm">
                {r.householdName}: {r.error}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative grow sm:max-w-xs">
          <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchRecipients")}
            className="pl-9"
          />
        </div>
        {events.length > 0 && (
          <Select value={filterEvent} onValueChange={setFilterEvent}>
            <SelectTrigger className="w-40">
              <Filter className="mr-1.5 size-3.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allEvents")}</SelectItem>
              {events.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {tags.length > 0 && (
          <Select value={filterTag} onValueChange={setFilterTag}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allTags")}</SelectItem>
              {tags.map((tg) => (
                <SelectItem key={tg.id} value={tg.id}>
                  {tg.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={filterSide} onValueChange={setFilterSide}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allSides")}</SelectItem>
            <SelectItem value="a">{t("sideA")}</SelectItem>
            <SelectItem value="b">{t("sideB")}</SelectItem>
            <SelectItem value="both">{t("sideBoth")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allStatuses")}</SelectItem>
            <SelectItem value="not_sent">{t("statusNotSent")}</SelectItem>
            <SelectItem value="sent">{t("statusSentFilter")}</SelectItem>
            <SelectItem value="no_contact">{t("statusNoContact")}</SelectItem>
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={hideDeclined}
            onChange={(e) => setHideDeclined(e.target.checked)}
            className="accent-primary size-4 rounded"
          />
          {t("hideDeclined")}
        </label>
      </div>

      {/* Count */}
      <p className="text-muted-foreground mb-3 text-sm">
        {t("showingCount", { count: filtered.length, total: recipients.length })}
      </p>

      {/* Recipient list */}
      <div className="space-y-2">
        {filtered.map((r) => (
          <RecipientCard
            key={r.householdId}
            r={r}
            tags={tags}
            onMethodChange={handleMethodChange}
            onCopyLink={handleCopyLink}
            onWhatsApp={handleWhatsApp}
            pending={pending}
            t={t}
          />
        ))}
        {filtered.length === 0 && (
          <p className="text-muted-foreground py-10 text-center text-sm">{t("noRecipients")}</p>
        )}
      </div>

      {/* Send confirmation dialog */}
      <Dialog open={showConfirm !== null} onOpenChange={(open) => { if (!open) setShowConfirm(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {showConfirm === "sms" ? t("sendSmsConfirmTitle") : t("sendConfirmTitle")}
            </DialogTitle>
            <DialogDescription>
              {showConfirm === "sms"
                ? t("sendSmsConfirmBody", { count: smsCount })
                : t("sendConfirmBody", { count: emailCount })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowConfirm(null)}>
              {t("sendCancel")}
            </Button>
            <Button onClick={confirmSend}>
              {showConfirm === "sms" ? <Phone className="mr-1.5 size-4" /> : <Mail className="mr-1.5 size-4" />}
              {t("sendConfirmButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  warn,
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
  warn?: boolean;
}) {
  return (
    <Card className={cn(warn && "border-warning/50")}>
      <CardContent className="px-4 py-3">
        <p className="font-serif text-2xl font-medium tabular-nums">{value}</p>
        <p className={cn("flex items-center gap-1 text-xs", warn ? "text-warning" : "text-muted-foreground")}>
          {icon}
          {label}
        </p>
      </CardContent>
    </Card>
  );
}

const STATUS_COLORS: Record<string, string> = {
  not_sent: "bg-muted text-muted-foreground",
  queued: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  delivered: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  opened: "bg-emerald-200 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-300",
  failed: "bg-destructive/10 text-destructive",
  opted_out: "bg-muted text-muted-foreground line-through",
};

function RecipientCard({
  r,
  tags,
  onMethodChange,
  onCopyLink,
  onWhatsApp,
  pending,
  t,
}: {
  r: RecipientRow;
  tags: { id: string; name: string }[];
  onMethodChange: (r: RecipientRow, method: string) => void;
  onCopyLink: (r: RecipientRow) => void;
  onWhatsApp: (r: RecipientRow) => void;
  pending: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const tagNames = tags.filter((tg) => r.tags.includes(tg.id)).map((tg) => tg.name);

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{r.householdName}</span>
            <Badge variant="outline" className={cn("text-xs", STATUS_COLORS[r.status])}>
              {t(`status.${r.status}` as "status.not_sent")}
            </Badge>
            {r.declined && (
              <Badge variant="outline" className="text-destructive text-xs">
                {t("statusDeclined")}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground truncate text-xs">
            {r.guestNames.join(", ")}
          </p>
          <div className="flex flex-wrap gap-3 text-xs">
            {r.emails.length > 0 && (
              <span className="flex items-center gap-1">
                <Mail className="size-3" />
                {r.emails[0]}
                {r.emails.length > 1 && ` +${r.emails.length - 1}`}
              </span>
            )}
            {r.phones.length > 0 && (
              <span className="flex items-center gap-1">
                <Phone className="size-3" />
                {r.phones[0]}
              </span>
            )}
            {!r.emails.length && !r.phones.length && (
              <span className="text-warning flex items-center gap-1">
                <XCircle className="size-3" />
                {t("missingContact")}
              </span>
            )}
          </div>
          {tagNames.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tagNames.map((n) => (
                <Badge key={n} variant="secondary" className="text-xs">
                  {n}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Select
            value={r.method ?? "none"}
            onValueChange={(v) => onMethodChange(r, v)}
            disabled={pending || r.status !== "not_sent"}
          >
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {r.emails.length > 0 && (
                <SelectItem value="email">
                  <Mail className="mr-1 inline size-3" />
                  Email
                </SelectItem>
              )}
              {r.phones.length > 0 && (
                <SelectItem value="sms">
                  <Phone className="mr-1 inline size-3" />
                  SMS
                </SelectItem>
              )}
              <SelectItem value="whatsapp">
                <MessageSquare className="mr-1 inline size-3" />
                WhatsApp
              </SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="none">{t("methodNone")}</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => onCopyLink(r)}
            disabled={!r.token}
            title={t("copyLink")}
          >
            <Copy className="size-3.5" />
          </Button>

          {r.phones.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => onWhatsApp(r)}
              disabled={!r.token}
              title="WhatsApp"
            >
              <ExternalLink className="size-3.5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
