"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import Papa from "papaparse";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Upload,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { importGuests, type ImportSummary } from "@/app/app/guests/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  guessMapping,
  IMPORT_FIELDS,
  mapRows,
  type ColumnMapping,
  type ImportFieldKey,
} from "@/lib/guests/csv";
import { fullName, sideLabel, type PartnerNames } from "@/lib/guests/model";
import { LanguageName } from "@/components/language-select";
import { cn } from "@/lib/utils";
import { MAX_IMPORT_ROWS } from "@/lib/validation/guest";

type Step = "upload" | "map" | "preview" | "done";
type Parsed = { fileName: string; headers: string[]; rows: Record<string, string>[] };

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const STEPS: Step[] = ["upload", "map", "preview", "done"];

export function ImportWizard({ names, eventNames }: { names: PartnerNames; eventNames: string[] }) {
  const t = useTranslations("guests.import");
  const [step, setStep] = useState<Step>("upload");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap gap-2 text-sm" aria-label={t("steps.label")}>
        {STEPS.map((s, i) => {
          const current = s === step;
          const done = STEPS.indexOf(step) > i;
          return (
            <li
              key={s}
              aria-current={current ? "step" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1",
                current && "border-primary bg-primary-soft font-medium",
                done && "text-muted-foreground",
              )}
            >
              <span className="tabular-nums">{i + 1}.</span> {t(`steps.${s}`)}
            </li>
          );
        })}
      </ol>

      {step === "upload" && (
        <UploadStep
          onParsed={(p) => {
            setParsed(p);
            setMapping(guessMapping(p.headers));
            setStep("map");
          }}
        />
      )}
      {step === "map" && parsed && (
        <MapStep
          parsed={parsed}
          mapping={mapping}
          onChange={setMapping}
          onBack={() => setStep("upload")}
          onNext={() => setStep("preview")}
        />
      )}
      {step === "preview" && parsed && (
        <PreviewStep
          parsed={parsed}
          mapping={mapping}
          names={names}
          eventNames={eventNames}
          onBack={() => setStep("map")}
          onDone={(s) => {
            setSummary(s);
            setStep("done");
          }}
        />
      )}
      {step === "done" && summary && (
        <DoneStep
          summary={summary}
          onAgain={() => {
            setParsed(null);
            setSummary(null);
            setStep("upload");
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function UploadStep({ onParsed }: { onParsed: (p: Parsed) => void }) {
  const t = useTranslations("guests.import");
  const c = useTranslations("guests.csv");
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFile(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
      setError(t("notCsv"));
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError(t("tooBig"));
      return;
    }
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
      complete: (result) => {
        const headers = (result.meta.fields ?? []).filter(Boolean);
        if (headers.length === 0 || result.data.length === 0) {
          setError(t("noRows"));
          return;
        }
        if (result.data.length > MAX_IMPORT_ROWS) {
          setError(t("tooManyRows", { count: result.data.length, max: MAX_IMPORT_ROWS }));
          return;
        }
        onParsed({ fileName: file.name, headers, rows: result.data });
      },
      error: () => setError(t("unreadable")),
    });
  }

  function downloadTemplate() {
    // headers in the person's language (the importer recognises them), plus an example row
    const header = Papa.unparse([
      [
        c("firstName"),
        c("lastName"),
        c("household"),
        c("side"),
        c("ageGroup"),
        c("email"),
        c("phone"),
        c("line1"),
        c("city"),
        c("postalCode"),
        c("country"),
        c("events"),
        c("tags"),
        c("dietary"),
        c("plusOneAllowed"),
        c("plusOneName"),
        c("language"),
      ],
    ]);
    const example =
      "\r\n" +
      Papa.unparse([
        [
          "Ann",
          "Smith",
          "The Smith Family",
          "Both",
          "Adult",
          "ann@example.com",
          "",
          "1 Main St",
          "Lisbon",
          "1000-001",
          "Portugal",
          "Ceremony, Reception",
          "Family",
          "Vegetarian",
          c("yes"),
          "Tom Jones",
          "English",
        ],
      ]) +
      "\r\n";
    const url = URL.createObjectURL(new Blob(["﻿" + header + example], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = t("templateFile");
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFile(e.dataTransfer.files[0]);
          }}
          className={cn(
            "has-[:focus-visible]:ring-ring flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors has-[:focus-visible]:ring-2",
            dragging ? "border-primary bg-primary-soft" : "hover:bg-muted/50",
          )}
        >
          <Upload className="text-primary-ink size-8" aria-hidden />
          <span className="font-medium">{t("drop")}</span>
          <span className="text-muted-foreground text-sm">
            {t.rich("saveAs", { b: (x) => <strong>{x}</strong> })}
          </span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </label>
        {error && (
          <p role="alert" className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
            {error}
          </p>
        )}
        <p className="text-muted-foreground text-sm">
          {t("notSure")}{" "}
          <Button variant="link" className="h-auto p-0" onClick={downloadTemplate}>
            {t("template")}
          </Button>
          . {t.rich("templateHint", { em: (x) => <em>{x}</em> })}
        </p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------

function MapStep({
  parsed,
  mapping,
  onChange,
  onBack,
  onNext,
}: {
  parsed: Parsed;
  mapping: ColumnMapping;
  onChange: (m: ColumnMapping) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const t = useTranslations("guests.import");
  const used = new Set(Object.values(mapping));
  const hasName = used.has("first_name") || used.has("last_name") || used.has("full_name");

  function setField(header: string, field: ImportFieldKey | "ignore") {
    const next = { ...mapping };
    // Each field can only be filled by one column: free it up elsewhere.
    if (field !== "ignore") {
      for (const h of Object.keys(next)) if (next[h] === field) next[h] = "ignore";
    }
    next[header] = field;
    onChange(next);
  }

  return (
    <Card>
      <CardContent className="space-y-5 p-6">
        <div className="flex items-center gap-2 text-sm">
          <FileSpreadsheet className="text-primary-ink size-5" aria-hidden />
          <strong>{parsed.fileName}</strong>
          <span className="text-muted-foreground">
            · {t("rows", { count: parsed.rows.length })}
          </span>
        </div>
        <p className="text-muted-foreground text-sm">{t("guessed")}</p>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-start text-xs">
              <tr>
                <th className="px-3 py-2 text-start font-medium">{t("yourColumn")}</th>
                <th className="px-3 py-2 text-start font-medium">{t("example")}</th>
                <th className="px-3 py-2 text-start font-medium">{t("importAs")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {parsed.headers.map((h) => {
                const examples = parsed.rows
                  .map((r) => r[h]?.trim())
                  .filter(Boolean)
                  .slice(0, 2)
                  .join(" · ");
                return (
                  <tr key={h}>
                    <td className="px-3 py-2 font-medium">{h}</td>
                    <td className="text-muted-foreground max-w-48 truncate px-3 py-2">
                      {examples || "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Select
                        value={mapping[h] ?? "ignore"}
                        onValueChange={(v) => setField(h, v as ImportFieldKey | "ignore")}
                      >
                        <SelectTrigger
                          className="w-56"
                          aria-label={t("importColumnAs", { name: h })}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ignore">{t("dontImport")}</SelectItem>
                          {IMPORT_FIELDS.map((f) => (
                            <SelectItem key={f.key} value={f.key}>
                              {t(`fields.${f.key}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!hasName && <Notice tone="error">{t("needName")}</Notice>}
        {hasName && !used.has("household") && <Notice tone="info">{t("noHousehold")}</Notice>}

        <div className="flex justify-between">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="rtl:rotate-180" aria-hidden /> {t("chooseAnother")}
          </Button>
          <Button onClick={onNext} disabled={!hasName}>
            {t("preview")} <ArrowRight className="rtl:rotate-180" aria-hidden />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------

function PreviewStep({
  parsed,
  mapping,
  names,
  eventNames,
  onBack,
  onDone,
}: {
  parsed: Parsed;
  mapping: ColumnMapping;
  names: PartnerNames;
  eventNames: string[];
  onBack: () => void;
  onDone: (s: ImportSummary) => void;
}) {
  const t = useTranslations("guests.import");
  const g = useTranslations("guests");
  const [pending, startTransition] = useTransition();
  const result = useMemo(() => mapRows(parsed.rows, mapping, names), [parsed, mapping, names]);
  const { guests, errors } = result;

  const known = new Set(eventNames.map((e) => e.toLowerCase()));
  const unknownEvents = [...new Set(guests.flatMap((g) => g.events))].filter(
    (e) => !known.has(e.toLowerCase()),
  );
  const households = new Set(guests.map((g) => g.household.toLowerCase())).size;
  const extraPlusOnes = guests.filter((g) => g.plusOneAllowed).length;
  const preview = guests.slice(0, 15);

  function runImport() {
    startTransition(async () => {
      const res = await importGuests(guests);
      if (res.ok) onDone(res.data);
      else toast.error(res.error);
    });
  }

  return (
    <Card>
      <CardContent className="space-y-5 p-6">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Figure label={t("guests")} value={guests.length} />
          <Figure label={t("households")} value={households} />
          <Figure label={t("withPlusOne")} value={extraPlusOnes} />
          <Figure label={t("skipped")} value={errors.length} />
        </dl>

        {errors.length > 0 && (
          <Notice tone="warning">
            {t("willSkip", { count: errors.length })}{" "}
            {errors
              .slice(0, 8)
              .map((e) => t("rowNoName", { row: e.row }))
              .join(", ")}
            {errors.length > 8 && "…"}
          </Notice>
        )}
        {unknownEvents.length > 0 && (
          <Notice tone="warning">
            {t.rich("unknownEvents", {
              events: unknownEvents.join(", "),
              link: (x) => (
                <Link href="/app/settings#events" className="underline">
                  {x}
                </Link>
              ),
            })}
          </Notice>
        )}
        <Notice tone="info">{t("merged")}</Notice>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-start text-xs">
              <tr>
                <th className="px-3 py-2 text-start font-medium">{g("list.name")}</th>
                <th className="px-3 py-2 text-start font-medium">{g("list.household")}</th>
                <th className="px-3 py-2 text-start font-medium">{g("list.side")}</th>
                <th className="px-3 py-2 text-start font-medium">{t("fields.email")}</th>
                <th className="px-3 py-2 text-start font-medium">{g("list.events")}</th>
                <th className="px-3 py-2 text-start font-medium">{g("list.tags")}</th>
                <th className="px-3 py-2 text-start font-medium">{t("fields.language")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {preview.map((row, i) => (
                <tr key={i}>
                  <td className="px-3 py-2 font-medium whitespace-nowrap">
                    {fullName(row.firstName, row.lastName)}
                    {row.plusOneAllowed && (
                      <span className="text-muted-foreground font-normal">
                        {" "}
                        +{row.plusOneName || "1"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">{row.household}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{sideLabel(row.side, names, g)}</td>
                  <td className="px-3 py-2">{row.email}</td>
                  <td className="px-3 py-2">
                    {row.events.join(", ") || <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2">{row.tags.join(", ")}</td>
                  <td className="px-3 py-2">
                    {row.language ? <LanguageName code={row.language} /> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {guests.length > preview.length && (
          <p className="text-muted-foreground text-sm">
            {t("andMore", { count: guests.length - preview.length })}
          </p>
        )}

        <div className="flex justify-between">
          <Button variant="ghost" onClick={onBack} disabled={pending}>
            <ArrowLeft className="rtl:rotate-180" aria-hidden /> {t("back")}
          </Button>
          <Button onClick={runImport} disabled={pending || guests.length === 0}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {t("run", { count: guests.length })}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------

function DoneStep({ summary, onAgain }: { summary: ImportSummary; onAgain: () => void }) {
  const t = useTranslations("guests.import");
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 p-10 text-center" role="status">
        <CheckCircle2 className="text-success size-12" aria-hidden />
        <h2 className="text-3xl">{t("complete")}</h2>
        <p className="text-muted-foreground">
          {t("added", { guests: summary.guests, households: summary.households })}{" "}
          {summary.tagsCreated > 0 && t("tagsCreated", { count: summary.tagsCreated })}
        </p>
        {summary.unknownEvents.length > 0 && (
          <p className="text-warning text-sm">
            {t("ignored", { events: summary.unknownEvents.join(", ") })}
          </p>
        )}
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href="/app/guests">{t("toList")}</Link>
          </Button>
          <Button variant="outline" onClick={onAgain}>
            {t("again")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-muted/50 rounded-lg p-3">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-serif text-3xl font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "info" | "warning" | "error";
  children: React.ReactNode;
}) {
  return (
    <p
      role={tone === "error" ? "alert" : undefined}
      className={cn(
        "flex gap-2 rounded-md p-3 text-sm",
        tone === "info" && "bg-muted text-muted-foreground",
        tone === "warning" && "bg-warning/10",
        tone === "error" && "bg-destructive/10 text-destructive",
      )}
    >
      {tone !== "info" && <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />}
      <span>{children}</span>
    </p>
  );
}
