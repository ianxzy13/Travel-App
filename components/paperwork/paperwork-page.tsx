"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  ClipboardList,
  ExternalLink,
  FileText,
  Globe,
  Info,
  ListChecks,
  Loader2,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import {
  savePaperworkItem,
  deletePaperworkItem,
  loadFromTemplate,
  createTasksFromPaperwork,
  uploadScan,
  removeScan,
} from "@/app/app/paperwork/actions";
import { PageHeader } from "@/components/app/page-header";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { PaperworkItemRow } from "@/lib/database.types";
import {
  COUNTRY_LIST,
  NATIONALITIES,
  REGIONS,
  TEMPLATES,
  getNationalityHague,
  getNationalityName,
  isDocumentExpired,
} from "@/lib/paperwork/templates";
import { cn } from "@/lib/utils";

const STATUSES = [
  "not_started",
  "requested",
  "received",
  "apostilled",
  "translated",
  "submitted",
] as const;

const PERSONS = ["partner_a", "partner_b", "shared"] as const;

type Props = {
  items: PaperworkItemRow[];
  members: { id: string; name: string }[];
  partnerA: string;
  partnerB: string;
  canEdit: boolean;
};

export function PaperworkPage({
  items,
  members,
  partnerA,
  partnerB,
  canEdit: editable,
}: Props) {
  const t = useTranslations("app.paperwork");
  const [editing, setEditing] = useState<PaperworkItemRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();
  const [showPicker, setShowPicker] = useState(false);

  const personLabel = (p: string) => {
    if (p === "partner_a") return partnerA;
    if (p === "partner_b") return partnerB;
    return t("shared");
  };

  const statusLabel = (s: string) => t(`status.${s}` as Parameters<typeof t>[0]);
  const today = new Date().toISOString().slice(0, 10);
  const doneCount = items.filter((i) => i.status === "submitted").length;

  const grouped = useMemo(() => {
    const groups: Record<string, PaperworkItemRow[]> = {};
    for (const person of PERSONS) {
      groups[person] = items.filter((i) => i.person === person);
    }
    return groups;
  }, [items]);

  function handleLoadTemplate(
    countryCode: string,
    nationalityA?: string,
    nationalityB?: string,
  ) {
    startTransition(async () => {
      const r = await loadFromTemplate(countryCode, nationalityA, nationalityB);
      if (r.ok) {
        const tmpl = TEMPLATES[countryCode];
        toast.success(t("templateLoaded", { country: tmpl?.countryName ?? countryCode }));
        setShowPicker(false);
      } else {
        toast.error(r.error);
      }
    });
  }

  function handleCreateTasks() {
    startTransition(async () => {
      const r = await createTasksFromPaperwork();
      if (r.ok) toast.success(t("tasksCreated"));
      else toast.error(r.error);
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          editable && items.length > 0 ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPicker(true)}
                disabled={pending}
              >
                <Globe className="size-4" aria-hidden />
                {t("loadTemplate")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCreateTasks}
                disabled={pending}
              >
                <ListChecks className="size-4" aria-hidden />
                {t("createTasks")}
              </Button>
              <Button size="sm" onClick={() => setAdding(true)}>
                <Plus className="size-4" aria-hidden />
                {t("add")}
              </Button>
            </div>
          ) : undefined
        }
      />

      {items.length === 0 && !showPicker ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardList
              className="text-muted-foreground mx-auto mb-4 size-12"
              aria-hidden
            />
            <p className="text-muted-foreground mb-4 text-sm">{t("empty")}</p>
            {editable && (
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Button onClick={() => setShowPicker(true)} disabled={pending}>
                  <Globe className="size-4" aria-hidden />
                  {t("pickCountry")}
                </Button>
                <Button variant="outline" onClick={() => setAdding(true)}>
                  <Plus className="size-4" aria-hidden />
                  {t("addManual")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : showPicker ? (
        <CountryPicker
          onSelect={handleLoadTemplate}
          onCancel={() => setShowPicker(false)}
          pending={pending}
          partnerA={partnerA}
          partnerB={partnerB}
          t={t}
        />
      ) : (
        <>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <p className="text-sm">
                  <span className="font-serif text-3xl font-medium tabular-nums">
                    {doneCount}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    {t("ofDone", { total: items.length })}
                  </span>
                </p>
                {items.some(
                  (i) => i.due_date && i.due_date < today && i.status !== "submitted",
                ) && (
                  <span className="text-destructive flex items-center gap-1 text-sm">
                    <AlertTriangle className="size-4" aria-hidden />
                    {t("overdue")}
                  </span>
                )}
              </div>
              <div className="bg-muted mt-2 h-2 rounded-full">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{
                    width: `${items.length ? (doneCount / items.length) * 100 : 0}%`,
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {PERSONS.map(
            (person) =>
              grouped[person].length > 0 && (
                <section key={person} className="space-y-3">
                  <h2 className="font-serif text-xl font-medium">
                    {personLabel(person)}
                  </h2>
                  <div className="space-y-2">
                    {grouped[person].map((item) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        statusLabel={statusLabel}
                        today={today}
                        editable={editable}
                        onEdit={() => setEditing(item)}
                      />
                    ))}
                  </div>
                </section>
              ),
          )}

          <p className="text-muted-foreground text-xs">
            {t("disclaimer")}
          </p>
        </>
      )}

      <ItemSheet
        open={adding || editing !== null}
        item={editing}
        members={members}
        partnerA={partnerA}
        partnerB={partnerB}
        onClose={() => {
          setEditing(null);
          setAdding(false);
        }}
        t={t}
      />
    </div>
  );
}

// ── Country picker ──────────────────────────────────────────────────────

function NationalitySelect({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const lc = q.toLowerCase();
  const list = lc
    ? NATIONALITIES.filter((n) => n.name.toLowerCase().includes(lc))
    : NATIONALITIES;
  const selected = NATIONALITIES.find((n) => n.code === value);

  return (
    <div className="relative flex-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition",
          open ? "border-primary ring-primary/20 ring-2" : "hover:bg-accent/30",
        )}
      >
        <span className={selected ? "" : "text-muted-foreground"}>
          {selected ? selected.name : label}
        </span>
        <Globe className="text-muted-foreground size-4 shrink-0" aria-hidden />
      </button>
      {open && (
        <div className="bg-popover absolute z-10 mt-1 w-full rounded-lg border shadow-lg">
          <div className="border-b p-2">
            <Input
              placeholder={label}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-8 text-sm"
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto p-1">
            {list.map((n) => (
              <button
                key={n.code}
                type="button"
                onClick={() => { onChange(n.code); setOpen(false); setQ(""); }}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm",
                  value === n.code ? "bg-primary/10 font-medium" : "hover:bg-accent/30",
                )}
              >
                {n.name}
              </button>
            ))}
            {list.length === 0 && (
              <p className="text-muted-foreground py-3 text-center text-xs">
                No match
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CountryPicker({
  onSelect,
  onCancel,
  pending,
  partnerA,
  partnerB,
  t,
}: {
  onSelect: (code: string, natA?: string, natB?: string) => void;
  onCancel: () => void;
  pending: boolean;
  partnerA: string;
  partnerB: string;
  t: ReturnType<typeof useTranslations<"app.paperwork">>;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [natA, setNatA] = useState("");
  const [natB, setNatB] = useState("");

  const lc = search.toLowerCase();
  const filtered = lc
    ? COUNTRY_LIST.filter((c) => c.name.toLowerCase().includes(lc))
    : COUNTRY_LIST;

  const selectedTemplate = selected ? TEMPLATES[selected] : null;

  const natAName = natA ? getNationalityName(natA) : null;
  const natBName = natB ? getNationalityName(natB) : null;
  const natAHague = natA ? getNationalityHague(natA) : null;
  const natBHague = natB ? getNationalityHague(natB) : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 py-6">
          <div>
            <h2 className="font-serif text-lg font-medium">{t("nationality.title")}</h2>
            <p className="text-muted-foreground mt-1 text-sm">{t("nationality.desc")}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium">{partnerA}</label>
              <NationalitySelect value={natA} onChange={setNatA} label={t("nationality.search")} />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium">{partnerB}</label>
              <NationalitySelect value={natB} onChange={setNatB} label={t("nationality.search")} />
            </div>
          </div>
          {(natAName || natBName) && selectedTemplate && (
            <div className="bg-muted/50 space-y-1 rounded-lg p-3">
              {natAName && (
                <p className="text-xs">
                  <strong>{partnerA}</strong> ({natAName}):{" "}
                  {natAHague && selectedTemplate.hagueConvention
                    ? t("nationality.apostilleOk")
                    : t("nationality.legalizationNeeded")}
                </p>
              )}
              {natBName && (
                <p className="text-xs">
                  <strong>{partnerB}</strong> ({natBName}):{" "}
                  {natBHague && selectedTemplate.hagueConvention
                    ? t("nationality.apostilleOk")
                    : t("nationality.legalizationNeeded")}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 py-6">
          <div className="text-center">
            <Globe className="text-muted-foreground mx-auto mb-3 size-10" aria-hidden />
            <h2 className="font-serif text-xl font-medium">{t("pickCountryTitle")}</h2>
            <p className="text-muted-foreground mt-1 text-sm">{t("pickCountryDesc")}</p>
          </div>

          <div className="relative">
            <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" aria-hidden />
            <Input
              placeholder={t("searchCountries")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="max-h-80 space-y-4 overflow-y-auto">
            {REGIONS.map((region) => {
              const countries = filtered.filter((c) => c.region === region.key);
              if (countries.length === 0) return null;
              return (
                <div key={region.key}>
                  <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
                    {region.label}
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    {countries.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => setSelected(c.code)}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-left text-sm transition",
                          selected === c.code
                            ? "border-primary bg-primary/5 font-medium"
                            : "hover:bg-accent/30",
                        )}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-muted-foreground py-6 text-center text-sm">
                {t("noCountryMatch")}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedTemplate && (
        <Card>
          <CardContent className="space-y-3 py-4">
            <h3 className="font-serif text-lg font-medium">
              {selectedTemplate.countryName}
            </h3>
            <p className="text-muted-foreground text-sm">{selectedTemplate.notes}</p>
            <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <span>
                <strong>{t("countryInfo.language")}:</strong> {selectedTemplate.languageRequired}
              </span>
              {selectedTemplate.residencyDays > 0 && (
                <span>
                  <strong>{t("countryInfo.residency")}:</strong>{" "}
                  {t("countryInfo.residencyDays", { days: selectedTemplate.residencyDays })}
                </span>
              )}
              <span>
                <strong>{t("countryInfo.apostille")}:</strong>{" "}
                {selectedTemplate.hagueConvention ? t("countryInfo.yes") : t("countryInfo.legalization")}
              </span>
              <span>
                <strong>{t("countryInfo.documents")}:</strong>{" "}
                {selectedTemplate.items.length} {t("countryInfo.items")}
              </span>
            </div>
            {selectedTemplate.officialLink && (
              <a
                href={selectedTemplate.officialLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary inline-flex items-center gap-1 text-xs underline underline-offset-2"
              >
                {t("countryInfo.officialSite")} <ExternalLink className="size-3" aria-hidden />
              </a>
            )}
            <div className="bg-muted/50 flex items-start gap-2 rounded-lg p-3">
              <Info className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
              <p className="text-muted-foreground text-xs">{t("disclaimer")}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button
          onClick={() => selected && onSelect(selected, natA || undefined, natB || undefined)}
          disabled={!selected || pending}
          className="flex-1"
        >
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {selected
            ? t("loadCountryTemplate", { country: TEMPLATES[selected]?.countryName ?? selected })
            : t("pickCountry")}
        </Button>
      </div>
    </div>
  );
}

// ── Item card ───────────────────────────────────────────────────────────

function ItemCard({
  item,
  statusLabel,
  today,
  editable,
  onEdit,
}: {
  item: PaperworkItemRow;
  statusLabel: (s: string) => string;
  today: string;
  editable: boolean;
  onEdit: () => void;
}) {
  const done = item.status === "submitted";
  const overdue =
    !done && item.due_date != null && item.due_date < today;
  const expired =
    item.issue_date &&
    item.max_age_months &&
    isDocumentExpired(item.issue_date, item.max_age_months, today);

  return (
    <button
      type="button"
      onClick={editable ? onEdit : undefined}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border p-4 text-start transition",
        editable && "hover:bg-accent/30",
        overdue && "border-destructive/50",
      )}
    >
      {done ? (
        <CheckCircle2
          className="text-success mt-0.5 size-5 shrink-0"
          aria-hidden
        />
      ) : (
        <Circle
          className={cn(
            "mt-0.5 size-5 shrink-0",
            overdue ? "text-destructive" : "text-muted-foreground",
          )}
          aria-hidden
        />
      )}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm font-medium",
            done && "text-muted-foreground line-through",
          )}
        >
          {item.title}
        </p>
        <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
          <span
            className={cn(
              "rounded-full border px-2 py-0.5",
              done && "bg-success/10 border-success/30 text-success",
            )}
          >
            {statusLabel(item.status)}
          </span>
          {item.due_date && (
            <span className={overdue ? "text-destructive font-medium" : ""}>
              {item.due_date}
            </span>
          )}
          {item.file_path && (
            <span className="inline-flex items-center gap-1">
              <FileText className="size-3" aria-hidden />
              scan
            </span>
          )}
          {expired && (
            <span className="text-destructive inline-flex items-center gap-1">
              <AlertTriangle className="size-3" aria-hidden />
              expired
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Item edit sheet ─────────────────────────────────────────────────────

function ItemSheet({
  open,
  item,
  members,
  partnerA,
  partnerB,
  onClose,
  t,
}: {
  open: boolean;
  item: PaperworkItemRow | null;
  members: { id: string; name: string }[];
  partnerA: string;
  partnerB: string;
  onClose: () => void;
  t: ReturnType<typeof useTranslations<"app.paperwork">>;
}) {
  const isNew = !item;
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(item?.title ?? "");
  const [person, setPerson] = useState<string>(item?.person ?? "partner_a");
  const [status, setStatus] = useState<string>(item?.status ?? "not_started");
  const [responsibleId, setResponsibleId] = useState<string>(
    item?.responsible_id ?? "",
  );
  const [dueDate, setDueDate] = useState(item?.due_date ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [issueDate, setIssueDate] = useState(item?.issue_date ?? "");
  const [maxAgeMonths, setMaxAgeMonths] = useState(
    item?.max_age_months?.toString() ?? "",
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = (newItem: PaperworkItemRow | null) => {
    setTitle(newItem?.title ?? "");
    setPerson(newItem?.person ?? "partner_a");
    setStatus(newItem?.status ?? "not_started");
    setResponsibleId(newItem?.responsible_id ?? "");
    setDueDate(newItem?.due_date ?? "");
    setNotes(newItem?.notes ?? "");
    setIssueDate(newItem?.issue_date ?? "");
    setMaxAgeMonths(newItem?.max_age_months?.toString() ?? "");
  };

  useMemo(() => reset(item), [item]);

  function handleSave() {
    startTransition(async () => {
      const r = await savePaperworkItem(
        {
          title,
          person,
          status,
          responsibleId: responsibleId || null,
          dueDate: dueDate || null,
          notes: notes || null,
          issueDate: issueDate || null,
          maxAgeMonths: maxAgeMonths ? Number(maxAgeMonths) : null,
          sortOrder: item?.sort_order ?? 0,
        },
        item?.id,
      );
      if (r.ok) {
        toast.success(isNew ? t("added") : t("saved"));
        onClose();
      } else {
        toast.error(r.error);
      }
    });
  }

  function handleDelete() {
    if (!item) return;
    startTransition(async () => {
      const r = await deletePaperworkItem(item.id);
      if (r.ok) {
        toast.success(t("deleted"));
        onClose();
      } else toast.error(r.error);
    });
  }

  function handleUpload() {
    fileInputRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !item) return;
    const fd = new FormData();
    fd.append("file", file);
    startTransition(async () => {
      const r = await uploadScan(item.id, fd);
      if (r.ok) toast.success(t("scanUploaded"));
      else toast.error(r.error);
    });
  }

  function handleRemoveScan() {
    if (!item) return;
    startTransition(async () => {
      const r = await removeScan(item.id);
      if (r.ok) toast.success(t("scanRemoved"));
      else toast.error(r.error);
    });
  }

  const personLabel = (p: string) => {
    if (p === "partner_a") return partnerA;
    if (p === "partner_b") return partnerB;
    return t("shared");
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isNew ? t("addTitle") : t("editTitle")}</SheetTitle>
          <SheetDescription>{isNew ? t("addDesc") : t("editDesc")}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <FormField id="pw-title" label={t("field.title")}>
            {(aria) => <Input {...aria} value={title} onChange={(e) => setTitle(e.target.value)} />}
          </FormField>

          <FormField id="pw-person" label={t("field.person")}>
            {() => (
              <Select value={person} onValueChange={setPerson}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERSONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {personLabel(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          <FormField id="pw-status" label={t("field.status")}>
            {() => (
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`status.${s}` as Parameters<typeof t>[0])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          <FormField id="pw-responsible" label={t("field.responsible")}>
            {() => (
              <Select
                value={responsibleId || "__none"}
                onValueChange={(v) => setResponsibleId(v === "__none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">{t("noOne")}</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          <FormField id="pw-due" label={t("field.dueDate")}>
            {(aria) => (
              <Input
                {...aria}
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            )}
          </FormField>

          <FormField id="pw-issue" label={t("field.issueDate")}>
            {(aria) => (
              <Input
                {...aria}
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            )}
          </FormField>

          <FormField id="pw-maxage" label={t("field.maxAge")}>
            {(aria) => (
              <Input
                {...aria}
                type="number"
                min={1}
                placeholder="6"
                value={maxAgeMonths}
                onChange={(e) => setMaxAgeMonths(e.target.value)}
              />
            )}
          </FormField>

          <FormField id="pw-notes" label={t("field.notes")}>
            {(aria) => (
              <Textarea
                {...aria}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            )}
          </FormField>

          {item && (
            <FormField id="pw-scan" label={t("field.scan")}>
              {() => (
                <div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleUpload}
                      disabled={pending}
                    >
                      <Upload className="size-4" aria-hidden />
                      {t("uploadScan")}
                    </Button>
                    {item.file_path && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveScan}
                        disabled={pending}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      className="hidden"
                      onChange={onFileChange}
                    />
                  </div>
                  {item.file_path && (
                    <p className="text-muted-foreground mt-1 text-xs">
                      {item.file_path.split("/").pop()}
                    </p>
                  )}
                </div>
              )}
            </FormField>
          )}
        </div>

        <SheetFooter className="mt-6 flex gap-2">
          {item && (
            <ConfirmDialog
              title={t("deleteTitle")}
              description={t("deleteDesc")}
              onConfirm={handleDelete}
              trigger={
                <Button variant="destructive" size="sm" disabled={pending}>
                  <Trash2 className="size-4" aria-hidden />
                  {t("delete")}
                </Button>
              }
            />
          )}
          <Button
            onClick={handleSave}
            disabled={pending || !title.trim()}
            className="flex-1"
          >
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {isNew ? t("add") : t("save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
