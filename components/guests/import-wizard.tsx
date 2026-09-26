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
import { cn } from "@/lib/utils";
import { MAX_IMPORT_ROWS } from "@/lib/validation/guest";

type Step = "upload" | "map" | "preview" | "done";
type Parsed = { fileName: string; headers: string[]; rows: Record<string, string>[] };

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const STEPS: { id: Step; label: string }[] = [
  { id: "upload", label: "Upload" },
  { id: "map", label: "Match columns" },
  { id: "preview", label: "Preview" },
  { id: "done", label: "Done" },
];

export function ImportWizard({ names, eventNames }: { names: PartnerNames; eventNames: string[] }) {
  const [step, setStep] = useState<Step>("upload");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap gap-2 text-sm" aria-label="Import steps">
        {STEPS.map((s, i) => {
          const current = s.id === step;
          const done = STEPS.findIndex((x) => x.id === step) > i;
          return (
            <li
              key={s.id}
              aria-current={current ? "step" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1",
                current && "border-primary bg-primary-soft font-medium",
                done && "text-muted-foreground",
              )}
            >
              <span className="tabular-nums">{i + 1}.</span> {s.label}
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
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFile(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
      setError(
        "Please choose a .csv file. In Excel or Google Sheets use File → Download / Save as → CSV.",
      );
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("That file is larger than 5 MB. Please split it into smaller files.");
      return;
    }
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
      complete: (result) => {
        const headers = (result.meta.fields ?? []).filter(Boolean);
        if (headers.length === 0 || result.data.length === 0) {
          setError("We couldn't find any rows. Make sure the first row has column names.");
          return;
        }
        if (result.data.length > MAX_IMPORT_ROWS) {
          setError(
            `That file has ${result.data.length} rows. Please import at most ${MAX_IMPORT_ROWS} at a time.`,
          );
          return;
        }
        onParsed({ fileName: file.name, headers, rows: result.data });
      },
      error: () => setError("We couldn't read that file. Is it a valid CSV?"),
    });
  }

  function downloadTemplate() {
    const header =
      "First name,Last name,Household,Side,Age group,Email,Phone,Address line 1,City,Postal code,Country,Events,Tags,Dietary,Plus-one allowed,Plus-one name\r\n";
    const example =
      'Ann,Smith,The Smith Family,Both,Adult,ann@example.com,,1 Main St,Lisbon,1000-001,Portugal,"Ceremony, Reception",Family,Vegetarian,Yes,Tom Jones\r\n';
    const url = URL.createObjectURL(new Blob(["﻿" + header + example], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "guest-list-template.csv";
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
          <Upload className="text-primary size-8" aria-hidden />
          <span className="font-medium">Drop your CSV file here, or click to choose</span>
          <span className="text-muted-foreground text-sm">
            Excel / Numbers / Google Sheets: save or download as <strong>CSV (UTF-8)</strong> first.
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
          Not sure how to lay it out?{" "}
          <Button variant="link" className="h-auto p-0" onClick={downloadTemplate}>
            Download a template
          </Button>
          . One row per person; people with the same <em>Household</em> share one invitation.
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
          <FileSpreadsheet className="text-primary size-5" aria-hidden />
          <strong>{parsed.fileName}</strong>
          <span className="text-muted-foreground">· {parsed.rows.length} rows</span>
        </div>
        <p className="text-muted-foreground text-sm">
          We guessed what each column contains. Check the matches and change any that are wrong.
        </p>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-left text-xs">
              <tr>
                <th className="px-3 py-2 font-medium">Your column</th>
                <th className="px-3 py-2 font-medium">Example</th>
                <th className="px-3 py-2 font-medium">Import as</th>
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
                        <SelectTrigger className="w-56" aria-label={`Import column ${h} as`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ignore">Don&apos;t import</SelectItem>
                          {IMPORT_FIELDS.map((f) => (
                            <SelectItem key={f.key} value={f.key}>
                              {f.label}
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

        {!hasName && (
          <Notice tone="error">
            Please match at least one column to First name, Last name or Full name.
          </Notice>
        )}
        {hasName && !used.has("household") && (
          <Notice tone="info">
            No household column: each person gets their own household (and their own RSVP link). Map
            a column like “Family” or “Group” to keep families together.
          </Notice>
        )}

        <div className="flex justify-between">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft aria-hidden /> Choose another file
          </Button>
          <Button onClick={onNext} disabled={!hasName}>
            Preview <ArrowRight aria-hidden />
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
          <Figure label="Guests" value={guests.length} />
          <Figure label="Households" value={households} />
          <Figure label="With a plus-one" value={extraPlusOnes} />
          <Figure label="Rows skipped" value={errors.length} />
        </dl>

        {errors.length > 0 && (
          <Notice tone="warning">
            {errors.length} row{errors.length === 1 ? "" : "s"} will be skipped:{" "}
            {errors
              .slice(0, 8)
              .map((e) => `row ${e.row} (${e.message.toLowerCase()})`)
              .join(", ")}
            {errors.length > 8 && "…"}
          </Notice>
        )}
        {unknownEvents.length > 0 && (
          <Notice tone="warning">
            These events don&apos;t exist yet and will be ignored: {unknownEvents.join(", ")}. Add
            them in{" "}
            <Link href="/app/settings#events" className="underline">
              Settings → Events
            </Link>{" "}
            first if you need them.
          </Notice>
        )}
        <Notice tone="info">
          Guests are added to your list; existing guests are not changed. Households with the same
          name as an existing one are merged into it.
        </Notice>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-left text-xs">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Household</th>
                <th className="px-3 py-2 font-medium">Side</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Events</th>
                <th className="px-3 py-2 font-medium">Tags</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {preview.map((g, i) => (
                <tr key={i}>
                  <td className="px-3 py-2 font-medium whitespace-nowrap">
                    {fullName(g.firstName, g.lastName)}
                    {g.plusOneAllowed && (
                      <span className="text-muted-foreground font-normal">
                        {" "}
                        +{g.plusOneName || "1"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">{g.household}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{sideLabel(g.side, names)}</td>
                  <td className="px-3 py-2">{g.email}</td>
                  <td className="px-3 py-2">
                    {g.events.join(", ") || <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2">{g.tags.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {guests.length > preview.length && (
          <p className="text-muted-foreground text-sm">
            …and {guests.length - preview.length} more.
          </p>
        )}

        <div className="flex justify-between">
          <Button variant="ghost" onClick={onBack} disabled={pending}>
            <ArrowLeft aria-hidden /> Back
          </Button>
          <Button onClick={runImport} disabled={pending || guests.length === 0}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            Import {guests.length} guest{guests.length === 1 ? "" : "s"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------

function DoneStep({ summary, onAgain }: { summary: ImportSummary; onAgain: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 p-10 text-center" role="status">
        <CheckCircle2 className="text-success size-12" aria-hidden />
        <h2 className="text-3xl">Import complete</h2>
        <p className="text-muted-foreground">
          Added {summary.guests} guest{summary.guests === 1 ? "" : "s"} (including plus-ones) in{" "}
          {summary.households} new household{summary.households === 1 ? "" : "s"}
          {summary.tagsCreated > 0 &&
            `, and created ${summary.tagsCreated} new tag${summary.tagsCreated === 1 ? "" : "s"}`}
          .
        </p>
        {summary.unknownEvents.length > 0 && (
          <p className="text-warning text-sm">
            Ignored unknown events: {summary.unknownEvents.join(", ")}
          </p>
        )}
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href="/app/guests">Go to guest list</Link>
          </Button>
          <Button variant="outline" onClick={onAgain}>
            Import another file
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
      <dd className="font-serif text-3xl font-semibold tabular-nums">{value}</dd>
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
