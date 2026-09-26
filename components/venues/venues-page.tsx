"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, parseISO } from "date-fns";
import {
  AlertTriangle,
  Check,
  Columns3,
  Landmark,
  Loader2,
  MapPin,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  deleteChecklistItem,
  deleteVenue,
  saveChecklistItem,
  saveVenue,
} from "@/app/app/venues/actions";
import { PageHeader } from "@/components/app/page-header";
import { MoneyInput } from "@/components/budget/money-input";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PhotosField } from "@/components/files/photos-field";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { StarRating } from "@/components/ui/star-rating";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { VenueChecklistRow, VenueRow } from "@/lib/database.types";
import { formatMoney } from "@/lib/budget/money";
import { AVAILABILITY, VENUE_KIND, VENUE_STATUS } from "@/lib/places/labels";
import { mapsSearch } from "@/lib/places/travel";
import { cn } from "@/lib/utils";
import { venueSchema, type VenueValues } from "@/lib/validation/places";

export type VenueItem = Omit<VenueRow, "price"> & {
  price: number | null;
  coverUrl: string | null;
  checklist: VenueChecklistRow[];
};

type Props = {
  venues: VenueItem[];
  weddingId: string;
  currency: string;
  location: string | null;
  /** people we expect (attending guests, or the estimate) */
  guestCount: number | null;
  canEdit: boolean;
};

export function VenuesPage({ venues, weddingId, currency, location, guestCount, canEdit }: Props) {
  const [status, setStatus] = useState("all");
  const [kind, setKind] = useState("all");
  const [compare, setCompare] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const [sheet, setSheet] = useState<string | "new" | null>(null);

  const visible = useMemo(
    () =>
      venues
        .filter(
          (v) => (status === "all" || v.status === status) && (kind === "all" || v.kind === kind),
        )
        .sort(
          (a, b) =>
            Number(b.status === "booked") - Number(a.status === "booked") ||
            (b.rating ?? 0) - (a.rating ?? 0),
        ),
    [venues, status, kind],
  );
  const current = sheet && sheet !== "new" ? (venues.find((v) => v.id === sheet) ?? null) : null;

  function toggleCompare(id: string) {
    setCompare((c) =>
      c.includes(id)
        ? c.filter((x) => x !== id)
        : c.length >= 4
          ? (toast.info("Compare up to 4 venues at a time."), c)
          : [...c, id],
    );
  }

  return (
    <>
      <PageHeader
        title="Venues"
        description="Compare the places you're considering, and book the one."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <a
                href={mapsSearch(`wedding venues near ${location || "me"}`)}
                target="_blank"
                rel="noreferrer"
              >
                <Search aria-hidden /> Find venues{location ? ` near ${location}` : ""}
              </a>
            </Button>
            {canEdit && (
              <Button size="sm" onClick={() => setSheet("new")}>
                <Plus aria-hidden /> Add venue
              </Button>
            )}
          </>
        }
      />

      {venues.length === 0 ? (
        <div className="bg-card flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-16 text-center">
          <span className="bg-primary-soft text-primary inline-flex size-14 items-center justify-center rounded-full">
            <Landmark className="size-7" aria-hidden />
          </span>
          <h2 className="text-3xl">No venues yet</h2>
          <p className="text-muted-foreground max-w-sm">
            Add the places you&apos;re considering. Each one gets a site-visit checklist, and you
            can compare them side by side.
          </p>
          {canEdit && (
            <Button onClick={() => setSheet("new")}>
              <Plus aria-hidden /> Add your first venue
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-44" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any status</SelectItem>
                {Object.entries(VENUE_STATUS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger className="w-52" aria-label="Filter by type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Ceremony or reception</SelectItem>
                {Object.entries(VENUE_KIND).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground self-center text-sm">
              Tick up to 4 to compare them side by side.
            </p>
          </div>

          <ul className="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-4">
            {visible.map((v) => (
              <VenueCard
                key={v.id}
                venue={v}
                currency={currency}
                guestCount={guestCount}
                compared={compare.includes(v.id)}
                onCompare={() => toggleCompare(v.id)}
                onOpen={() => setSheet(v.id)}
              />
            ))}
          </ul>
        </div>
      )}

      {compare.length >= 2 && (
        <div className="bg-card fixed inset-x-3 bottom-20 z-40 mx-auto flex max-w-md items-center gap-2 rounded-2xl border p-2 pl-4 shadow-xl md:bottom-6">
          <span className="flex-1 text-sm font-medium">{compare.length} venues selected</span>
          <Button size="sm" onClick={() => setComparing(true)}>
            <Columns3 aria-hidden /> Compare
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setCompare([])}
            aria-label="Clear comparison"
          >
            <X aria-hidden />
          </Button>
        </div>
      )}

      <CompareDialog
        open={comparing}
        onOpenChange={setComparing}
        venues={compare
          .map((id) => venues.find((v) => v.id === id))
          .filter((v): v is VenueItem => !!v)}
        currency={currency}
        guestCount={guestCount}
      />

      <Sheet open={!!sheet} onOpenChange={(o) => !o && setSheet(null)}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
          {sheet && (
            <VenueForm
              key={sheet}
              venue={current}
              weddingId={weddingId}
              currency={currency}
              canEdit={canEdit}
              onClose={() => setSheet(null)}
              onCreated={(id) => setSheet(id)}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span
      className={cn("rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", className)}
    >
      {children}
    </span>
  );
}

function VenueCard({
  venue: v,
  currency,
  guestCount,
  compared,
  onCompare,
  onOpen,
}: {
  venue: VenueItem;
  currency: string;
  guestCount: number | null;
  compared: boolean;
  onCompare: () => void;
  onOpen: () => void;
}) {
  const answered = v.checklist.filter((c) => c.done || c.answer).length;
  const tooSmall = v.capacity != null && guestCount != null && v.capacity < guestCount;
  return (
    <li
      className={cn(
        "bg-card relative flex flex-col overflow-hidden rounded-xl border",
        v.status === "booked" && "ring-2 ring-emerald-500/60",
        compared && "ring-primary ring-2",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="focus-visible:ring-ring flex flex-1 flex-col text-left focus-visible:ring-2 focus-visible:outline-none"
      >
        <div className="bg-muted relative aspect-[16/9]">
          {v.coverUrl ? (
            <Image
              src={v.coverUrl}
              alt=""
              fill
              sizes="(max-width: 640px) 100vw, 320px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <Landmark className="text-muted-foreground/50 size-10" aria-hidden />
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2 p-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge className={VENUE_STATUS[v.status].className}>
              {VENUE_STATUS[v.status].label}
            </Badge>
            <Badge className={AVAILABILITY[v.availability].className}>
              {AVAILABILITY[v.availability].label}
            </Badge>
          </div>
          <p className="font-serif text-2xl leading-tight font-semibold">{v.name}</p>
          <p className="text-muted-foreground text-xs">{VENUE_KIND[v.kind]}</p>
          <StarRating value={v.rating} size="size-4" />
          <dl className="text-muted-foreground mt-auto grid grid-cols-2 gap-1 pt-2 text-sm">
            <div className={cn("flex items-center gap-1", tooSmall && "text-destructive")}>
              <Users className="size-3.5" aria-hidden />
              <dt className="sr-only">Capacity</dt>
              <dd>
                {v.capacity ?? "–"}
                {tooSmall && " (too small)"}
              </dd>
            </div>
            <div>
              <dt className="sr-only">Price</dt>
              <dd className="text-foreground text-right font-medium tabular-nums">
                {v.price == null ? "–" : formatMoney(v.price, currency)}
              </dd>
            </div>
          </dl>
          {v.address && (
            <p className="text-muted-foreground flex items-center gap-1 truncate text-xs">
              <MapPin className="size-3.5 shrink-0" aria-hidden /> {v.address}
            </p>
          )}
          <p className="text-muted-foreground text-xs">
            Visit checklist: {answered}/{v.checklist.length}
            {v.visit_date && ` · visit ${format(parseISO(v.visit_date), "d MMM")}`}
          </p>
        </div>
      </button>
      <label className="bg-card/90 absolute top-2 right-2 flex items-center gap-1.5 rounded-full px-2 py-1 text-xs shadow-sm">
        <Checkbox checked={compared} onCheckedChange={onCompare} aria-label={`Compare ${v.name}`} />
        Compare
      </label>
    </li>
  );
}

// ---------------------------------------------------------------------------

function CompareDialog({
  open,
  onOpenChange,
  venues,
  currency,
  guestCount,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  venues: VenueItem[];
  currency: string;
  guestCount: number | null;
}) {
  const questions = [...new Set(venues.flatMap((v) => v.checklist.map((c) => c.question)))];
  const rows: { label: string; cell: (v: VenueItem) => React.ReactNode }[] = [
    { label: "Type", cell: (v) => VENUE_KIND[v.kind] },
    {
      label: "Status",
      cell: (v) => (
        <Badge className={VENUE_STATUS[v.status].className}>{VENUE_STATUS[v.status].label}</Badge>
      ),
    },
    {
      label: "Our date",
      cell: (v) => (
        <Badge className={AVAILABILITY[v.availability].className}>
          {AVAILABILITY[v.availability].label}
        </Badge>
      ),
    },
    {
      label: "Capacity",
      cell: (v) => (
        <span
          className={cn(
            v.capacity != null &&
              guestCount != null &&
              v.capacity < guestCount &&
              "text-destructive font-medium",
          )}
        >
          {v.capacity ?? "–"}
          {v.capacity != null && guestCount != null && v.capacity < guestCount && (
            <span className="block text-xs">
              <AlertTriangle className="mr-1 inline size-3" aria-hidden />
              Fewer than your {guestCount} guests
            </span>
          )}
        </span>
      ),
    },
    { label: "Price", cell: (v) => (v.price == null ? "–" : formatMoney(v.price, currency)) },
    { label: "Rating", cell: (v) => <StarRating value={v.rating} size="size-4" /> },
    { label: "Included", cell: (v) => v.included },
    { label: "Pros", cell: (v) => v.pros },
    { label: "Cons", cell: (v) => v.cons },
    {
      label: "Contact",
      cell: (v) => [v.contact_name, v.phone, v.email].filter(Boolean).join(" · "),
    },
    ...questions.map((q) => ({
      label: q,
      cell: (v: VenueItem) => {
        const item = v.checklist.find((c) => c.question === q);
        if (!item) return <span className="text-muted-foreground">–</span>;
        return (
          <span className="flex gap-1">
            {item.done && (
              <Check className="text-success mt-0.5 size-3.5 shrink-0" aria-label="Checked" />
            )}
            {item.answer ||
              (item.done ? "" : <span className="text-muted-foreground">Not asked yet</span>)}
          </span>
        );
      },
    })),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Compare venues</DialogTitle>
          <DialogDescription>Side by side, including your site-visit answers.</DialogDescription>
        </DialogHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] table-fixed text-sm">
            <thead>
              <tr>
                <th className="w-40" />
                {venues.map((v) => (
                  <th key={v.id} className="p-2 text-left align-bottom">
                    {v.coverUrl && (
                      <div className="bg-muted relative mb-2 aspect-[16/9] overflow-hidden rounded-lg">
                        <Image
                          src={v.coverUrl}
                          alt=""
                          fill
                          sizes="240px"
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    )}
                    <span className="font-serif text-xl font-semibold">{v.name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.label}>
                  <th
                    scope="row"
                    className="text-muted-foreground p-2 text-left align-top text-xs font-medium"
                  >
                    {r.label}
                  </th>
                  {venues.map((v) => (
                    <td key={v.id} className="p-2 align-top whitespace-pre-line">
                      {r.cell(v) || <span className="text-muted-foreground">–</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------

function toValues(v: VenueItem | null): VenueValues {
  return {
    name: v?.name ?? "",
    kind: v?.kind ?? "both",
    status: v?.status ?? "researching",
    availability: v?.availability ?? "unknown",
    address: v?.address ?? "",
    contactName: v?.contact_name ?? "",
    phone: v?.phone ?? "",
    email: v?.email ?? "",
    website: v?.website ?? "",
    capacity: v?.capacity ?? null,
    price: v?.price ?? null,
    included: v?.included ?? "",
    pros: v?.pros ?? "",
    cons: v?.cons ?? "",
    notes: v?.notes ?? "",
    rating: v?.rating ?? null,
    visitDate: v?.visit_date ?? "",
    photoPaths: v?.photo_paths ?? [],
  };
}

function VenueForm({
  venue,
  weddingId,
  currency,
  canEdit,
  onClose,
  onCreated,
}: {
  venue: VenueItem | null;
  weddingId: string;
  currency: string;
  canEdit: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const form = useForm({ resolver: zodResolver(venueSchema), defaultValues: toValues(venue) });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const r = await saveVenue(values, venue?.id);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      if (values.status === "booked")
        toast.success(`${values.name} is booked! 🎉 Add it to your events in Settings → Events.`);
      else
        toast.success(
          venue ? "Venue saved" : "Venue added, with a site-visit checklist to fill in",
        );
      if (venue) onClose();
      else onCreated(r.data.id);
    }),
  );

  const select = <K extends "kind" | "status" | "availability">(
    name: K,
    label: string,
    options: Record<string, string>,
  ) => (
    <FormField id={`v-${name}`} label={label}>
      {(aria) => (
        <Controller
          control={form.control}
          name={name}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger {...aria} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(options).map(([k, l]) => (
                  <SelectItem key={k} value={k}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      )}
    </FormField>
  );

  const details = (
    <form id="venue-form" onSubmit={onSubmit} noValidate>
      <fieldset disabled={!canEdit || pending} className="space-y-5">
        <FormField id="v-name" label="Name" error={errors.name?.message}>
          {(aria) => <Input {...aria} {...form.register("name")} />}
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          {select(
            "status",
            "Status",
            Object.fromEntries(Object.entries(VENUE_STATUS).map(([k, v]) => [k, v.label])),
          )}
          {select("kind", "For", VENUE_KIND)}
          {select(
            "availability",
            "Available on our date?",
            Object.fromEntries(Object.entries(AVAILABILITY).map(([k, v]) => [k, v.label])),
          )}
          <div className="space-y-2">
            <span className="text-sm font-medium">Rating</span>
            <Controller
              control={form.control}
              name="rating"
              render={({ field }) => (
                <StarRating value={field.value} onChange={field.onChange} label="Your rating" />
              )}
            />
          </div>
          <FormField id="v-cap" label="Capacity (guests)" error={errors.capacity?.message}>
            {(aria) => (
              <Controller
                control={form.control}
                name="capacity"
                render={({ field }) => (
                  <Input
                    {...aria}
                    inputMode="numeric"
                    value={field.value ?? ""}
                    onChange={(e) => {
                      const d = e.target.value.replace(/\D/g, "");
                      field.onChange(d === "" ? null : Number(d));
                    }}
                  />
                )}
              />
            )}
          </FormField>
          <FormField id="v-price" label="Price / quote" error={errors.price?.message}>
            {(aria) => (
              <Controller
                control={form.control}
                name="price"
                render={({ field }) => (
                  <MoneyInput
                    {...aria}
                    currency={currency}
                    allowEmpty
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            )}
          </FormField>
        </div>
        <FormField id="v-address" label="Address" error={errors.address?.message}>
          {(aria) => <Input {...aria} {...form.register("address")} />}
        </FormField>
        {venue?.address && (
          <Button asChild variant="outline" size="sm">
            <a href={mapsSearch(venue.address)} target="_blank" rel="noreferrer">
              <MapPin aria-hidden /> Open in Google Maps
            </a>
          </Button>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="v-contact" label="Contact person" error={errors.contactName?.message}>
            {(aria) => <Input {...aria} {...form.register("contactName")} />}
          </FormField>
          <FormField id="v-phone" label="Phone" error={errors.phone?.message}>
            {(aria) => <Input {...aria} type="tel" {...form.register("phone")} />}
          </FormField>
          <FormField id="v-email" label="Email" error={errors.email?.message}>
            {(aria) => <Input {...aria} type="email" {...form.register("email")} />}
          </FormField>
          <FormField id="v-web" label="Website" error={errors.website?.message}>
            {(aria) => (
              <Input {...aria} type="url" placeholder="https://" {...form.register("website")} />
            )}
          </FormField>
          <FormField id="v-visit" label="Visit date" error={errors.visitDate?.message}>
            {(aria) => <Input {...aria} type="date" {...form.register("visitDate")} />}
          </FormField>
        </div>
        <FormField id="v-included" label="What's included" error={errors.included?.message}>
          {(aria) => (
            <Textarea
              {...aria}
              rows={2}
              placeholder="Tables, chairs, catering, coordinator…"
              {...form.register("included")}
            />
          )}
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="v-pros" label="Pros" error={errors.pros?.message}>
            {(aria) => <Textarea {...aria} rows={3} {...form.register("pros")} />}
          </FormField>
          <FormField id="v-cons" label="Cons" error={errors.cons?.message}>
            {(aria) => <Textarea {...aria} rows={3} {...form.register("cons")} />}
          </FormField>
        </div>
        <FormField id="v-notes" label="Notes" error={errors.notes?.message}>
          {(aria) => <Textarea {...aria} rows={2} {...form.register("notes")} />}
        </FormField>
        <div className="space-y-2">
          <p className="text-sm font-medium">Photos</p>
          <Controller
            control={form.control}
            name="photoPaths"
            render={({ field }) => (
              <PhotosField
                weddingId={weddingId}
                folder="venues"
                value={field.value}
                onChange={field.onChange}
                disabled={!canEdit}
              />
            )}
          />
        </div>
      </fieldset>
    </form>
  );

  return (
    <>
      <SheetHeader className="border-b px-6 py-4">
        <SheetTitle className="font-serif text-3xl">
          {venue ? venue.name : "Add a venue"}
        </SheetTitle>
        <SheetDescription>
          {venue ? VENUE_KIND[venue.kind] : "Only the name is required."}
        </SheetDescription>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {venue ? (
          <Tabs defaultValue="details">
            <TabsList className="mb-4">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="checklist">
                Visit checklist ({venue.checklist.filter((c) => c.done || c.answer).length}/
                {venue.checklist.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="details">{details}</TabsContent>
            <TabsContent value="checklist">
              <Checklist venueId={venue.id} items={venue.checklist} canEdit={canEdit} />
            </TabsContent>
          </Tabs>
        ) : (
          details
        )}
      </div>
      {canEdit && (
        <SheetFooter className="flex-row flex-wrap items-center gap-2 border-t px-6 py-4">
          {venue && (
            <ConfirmDialog
              trigger={
                <Button variant="ghost" className="text-destructive mr-auto" disabled={pending}>
                  <Trash2 aria-hidden /> Delete
                </Button>
              }
              title={`Delete ${venue.name}?`}
              description="Its photos and checklist are deleted too."
              onConfirm={async () => {
                const r = await deleteVenue(venue.id);
                if (!r.ok) {
                  toast.error(r.error);
                  return false;
                }
                onClose();
              }}
            />
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={pending}>
              Close
            </Button>
            <Button type="submit" form="venue-form" disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              {venue ? "Save" : "Add venue"}
            </Button>
          </div>
        </SheetFooter>
      )}
    </>
  );
}

/** Site-visit questions: tick when asked, note the answer (saves as you go). */
function Checklist({
  venueId,
  items,
  canEdit,
}: {
  venueId: string;
  items: VenueChecklistRow[];
  canEdit: boolean;
}) {
  const [question, setQuestion] = useState("");
  const [pending, startTransition] = useTransition();

  const save = (item: VenueChecklistRow, patch: Partial<{ answer: string; done: boolean }>) =>
    startTransition(async () => {
      const r = await saveChecklistItem(
        venueId,
        { question: item.question, answer: item.answer ?? "", done: item.done, ...patch },
        item.id,
      );
      if (!r.ok) toast.error(r.error);
    });

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">
        Take this with you on your visit. Answers save as you type.
      </p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="rounded-lg border p-3">
            <div className="flex items-start gap-2">
              <Checkbox
                className="mt-0.5"
                checked={item.done}
                disabled={!canEdit}
                onCheckedChange={(c) => save(item, { done: c === true })}
                aria-label={`Asked: ${item.question}`}
              />
              <p className={cn("flex-1 text-sm font-medium", item.done && "text-muted-foreground")}>
                {item.question}
              </p>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Remove question: ${item.question}`}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await deleteChecklistItem(item.id);
                      if (!r.ok) toast.error(r.error);
                    })
                  }
                >
                  <X aria-hidden />
                </Button>
              )}
            </div>
            <Input
              className="mt-2 h-8"
              defaultValue={item.answer ?? ""}
              placeholder="Answer / notes"
              aria-label={`Answer: ${item.question}`}
              disabled={!canEdit}
              maxLength={1000}
              onBlur={(e) =>
                e.target.value !== (item.answer ?? "") &&
                save(item, {
                  answer: e.target.value,
                  done: item.done || e.target.value.trim() !== "",
                })
              }
            />
          </li>
        ))}
      </ul>
      {canEdit && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!question.trim()) return;
            startTransition(async () => {
              const r = await saveChecklistItem(venueId, { question, answer: "", done: false });
              if (r.ok) setQuestion("");
              else toast.error(r.error);
            });
          }}
        >
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Add your own question"
            aria-label="New question"
            maxLength={200}
          />
          <Button type="submit" variant="outline" disabled={pending || !question.trim()}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />} Add
          </Button>
        </form>
      )}
    </div>
  );
}
