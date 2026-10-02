"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AtSign,
  ExternalLink,
  Globe,
  Loader2,
  Mail,
  Phone,
  Plus,
  Search,
  Store,
  Trash2,
  WalletCards,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { previewLink } from "@/app/app/inspiration/actions";
import { addQuoteToBudget, deleteVendor, saveVendor } from "@/app/app/vendors/actions";
import { PageHeader } from "@/components/app/page-header";
import { MoneyInput } from "@/components/budget/money-input";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FileField } from "@/components/files/file-field";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { VendorRow } from "@/lib/database.types";
import { formatMoney, sumMoney } from "@/lib/budget/money";
import { committedCost } from "@/lib/budget/stats";
import { VENDOR_STATUS_CLASSES } from "@/lib/budget/suggested";
import { normalize } from "@/lib/guests/filter";
import { cn } from "@/lib/utils";
import { vendorSearchLinks } from "@/lib/vendors/search-links";
import { VENDOR_STATUS_VALUES, vendorSchema, type VendorValues } from "@/lib/validation/budget";

export type VendorItem = Omit<VendorRow, "quote"> & { quote: number | null };
type LinkedExpense = {
  id: string;
  vendorId: string;
  name: string;
  estimated: number;
  actual: number | null;
  paid: number;
};

type Props = {
  vendors: VendorItem[];
  categories: { id: string; name: string }[];
  expenses: LinkedExpense[];
  weddingId: string;
  currency: string;
  location: string | null;
  canEdit: boolean;
};

export function VendorsPage({
  vendors,
  categories,
  expenses,
  weddingId,
  currency,
  location,
  canEdit,
}: Props) {
  const t = useTranslations("vendors");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [sheet, setSheet] = useState<VendorItem | "new" | null>(null);
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const money = (v: number) => formatMoney(v, currency);

  const visible = useMemo(() => {
    const words = normalize(search).split(/\s+/).filter(Boolean);
    return vendors.filter((v) => {
      if (status !== "all" && v.status !== status) return false;
      if (category !== "all" && v.category_id !== category) return false;
      const hay = normalize([v.name, v.contact_name, v.email, v.notes].filter(Boolean).join(" "));
      return words.every((w) => hay.includes(w));
    });
  }, [vendors, search, status, category]);

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          canEdit && (
            <div className="flex gap-2">
              {location && (
                <FindVendorsDropdown
                  location={location}
                  category={category !== "all" ? categoryName.get(category) ?? null : null}
                />
              )}
              <Button size="sm" onClick={() => setSheet("new")}>
                <Plus aria-hidden /> {t("add")}
              </Button>
            </div>
          )
        }
      />

      {vendors.length === 0 ? (
        <div className="bg-card flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-16 text-center">
          <span className="bg-primary-soft text-primary-ink inline-flex size-14 items-center justify-center rounded-full">
            <Store className="size-7" aria-hidden />
          </span>
          <h2 className="text-3xl">{t("emptyTitle")}</h2>
          <p className="text-muted-foreground max-w-sm">{t("emptyText")}</p>
          {canEdit && (
            <Button onClick={() => setSheet("new")}>
              <Plus aria-hidden /> {t("addFirst")}
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
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
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="sm:w-44" aria-label={t("byStatus")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("anyStatus")}</SelectItem>
                {VENDOR_STATUS_VALUES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`statuses.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="sm:w-44" aria-label={t("byCategory")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allCategories")}</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {visible.length === 0 ? (
            <p className="text-muted-foreground py-10 text-center">{t("noMatch")}</p>
          ) : (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-4">
              {visible.map((v) => {
                const linked = expenses.filter((e) => e.vendorId === v.id);
                const committed = sumMoney(linked.map((e) => committedCost(e)));
                const paid = sumMoney(linked.map((e) => e.paid));
                return (
                  <li key={v.id}>
                    <button
                      type="button"
                      onClick={() => setSheet(v)}
                      className="bg-card hover:border-primary focus-visible:ring-ring flex h-full w-full flex-col gap-3 rounded-xl border p-4 text-start transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-serif text-2xl font-medium">{v.name}</p>
                          <p className="text-muted-foreground text-xs">
                            {v.category_id ? categoryName.get(v.category_id) : t("noCategory")}
                            {v.contact_name && ` · ${v.contact_name}`}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                            VENDOR_STATUS_CLASSES[v.status],
                          )}
                        >
                          {t(`statuses.${v.status}`)}
                        </span>
                      </div>
                      <div className="text-muted-foreground space-y-1 text-sm">
                        {v.email && (
                          <p className="flex items-center gap-1.5 truncate">
                            <Mail className="size-3.5 shrink-0" aria-hidden />
                            {v.email}
                          </p>
                        )}
                        {v.phone && (
                          <p className="flex items-center gap-1.5">
                            <Phone className="size-3.5 shrink-0" aria-hidden />
                            {v.phone}
                          </p>
                        )}
                      </div>
                      <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-xs tabular-nums">
                        <span>
                          {t.rich("quote", {
                            amount: v.quote == null ? "–" : money(v.quote),
                            b: (c) => <strong>{c}</strong>,
                          })}
                        </span>
                        {linked.length > 0 && (
                          <span>
                            {t.rich("inBudget", {
                              amount: money(committed),
                              b: (c) => <strong>{c}</strong>,
                            })}
                            {paid > 0 && t("paidSuffix", { amount: money(paid) })}
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <Sheet open={!!sheet} onOpenChange={(o) => !o && setSheet(null)}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
          {sheet && (
            <VendorForm
              key={sheet === "new" ? "new" : sheet.id}
              vendor={sheet === "new" ? null : sheet}
              categories={categories}
              linked={sheet === "new" ? [] : expenses.filter((e) => e.vendorId === sheet.id)}
              weddingId={weddingId}
              currency={currency}
              canEdit={canEdit}
              onClose={() => setSheet(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function VendorForm({
  vendor,
  categories,
  linked,
  weddingId,
  currency,
  canEdit,
  onClose,
}: {
  vendor: VendorItem | null;
  categories: { id: string; name: string }[];
  linked: LinkedExpense[];
  weddingId: string;
  currency: string;
  canEdit: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("vendors");
  const [pending, startTransition] = useTransition();
  const form = useForm({
    resolver: zodResolver(vendorSchema),
    defaultValues: {
      name: vendor?.name ?? "",
      categoryId: vendor?.category_id ?? null,
      contactName: vendor?.contact_name ?? "",
      email: vendor?.email ?? "",
      phone: vendor?.phone ?? "",
      website: vendor?.website ?? "",
      instagram: vendor?.instagram ?? "",
      address: vendor?.address ?? "",
      quote: vendor?.quote ?? null,
      status: vendor?.status ?? "researching",
      notes: vendor?.notes ?? "",
      contract: vendor?.contract_path
        ? { path: vendor.contract_path, name: vendor.contract_name ?? t("contractName") }
        : null,
    } satisfies VendorValues,
  });
  const { errors } = form.formState;
  const money = (v: number) => formatMoney(v, currency);

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const r = await saveVendor(values, vendor?.id);
      if (r.ok) {
        toast.success(vendor ? t("saved") : t("added"));
        onClose();
      } else toast.error(r.error);
    }),
  );

  return (
    <>
      <SheetHeader className="border-b px-6 py-4">
        <SheetTitle className="font-serif text-3xl">
          {vendor ? vendor.name : t("addTitle")}
        </SheetTitle>
        <SheetDescription>{t("onlyName")}</SheetDescription>
      </SheetHeader>
      <form
        id="vendor-form"
        onSubmit={onSubmit}
        noValidate
        className="flex-1 space-y-6 overflow-y-auto px-6 py-6"
      >
        <fieldset disabled={!canEdit || pending} className="space-y-5">
          {!vendor && (
            <FormField id="v-url" label={t("pasteUrl")} hint={t("pasteUrlHint")}>
              {(aria) => (
                <Input
                  {...aria}
                  type="url"
                  placeholder="https://"
                  onPaste={(e) => {
                    const text = e.clipboardData.getData("text/plain").trim();
                    if (!text || !/^https?:\/\//i.test(text)) return;
                    startTransition(async () => {
                      const r = await previewLink(text);
                      if (r.ok) {
                        if (r.data.title && !form.getValues("name"))
                          form.setValue("name", r.data.title.slice(0, 100));
                        if (!form.getValues("website"))
                          form.setValue("website", text.slice(0, 500));
                      }
                    });
                  }}
                />
              )}
            </FormField>
          )}
          <FormField id="v-name" label={t("business")} error={errors.name?.message}>
            {(aria) => <Input {...aria} {...form.register("name")} />}
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="v-cat" label={t("budgetCategory")}>
              {(aria) => (
                <Controller
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? "none"}
                      onValueChange={(v) => field.onChange(v === "none" ? null : v)}
                    >
                      <SelectTrigger {...aria} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("noCategory")}</SelectItem>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </FormField>
            <FormField id="v-status" label={t("status")}>
              {(aria) => (
                <Controller
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger {...aria} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VENDOR_STATUS_VALUES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {t(`statuses.${s}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </FormField>
            <FormField id="v-contact" label={t("contact")} error={errors.contactName?.message}>
              {(aria) => <Input {...aria} {...form.register("contactName")} />}
            </FormField>
            <FormField id="v-quote" label={t("quoteLabel")} error={errors.quote?.message}>
              {(aria) => (
                <Controller
                  control={form.control}
                  name="quote"
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
            <FormField id="v-email" label={t("email")} error={errors.email?.message}>
              {(aria) => <Input {...aria} type="email" {...form.register("email")} />}
            </FormField>
            <FormField id="v-phone" label={t("phone")} error={errors.phone?.message}>
              {(aria) => <Input {...aria} type="tel" {...form.register("phone")} />}
            </FormField>
            <FormField id="v-web" label={t("website")} error={errors.website?.message}>
              {(aria) => (
                <Input {...aria} type="url" placeholder="https://" {...form.register("website")} />
              )}
            </FormField>
            <FormField id="v-ig" label={t("instagram")} error={errors.instagram?.message}>
              {(aria) => <Input {...aria} placeholder="@handle" {...form.register("instagram")} />}
            </FormField>
          </div>
          <FormField id="v-address" label={t("address")} error={errors.address?.message}>
            {(aria) => <Input {...aria} {...form.register("address")} />}
          </FormField>
          <FormField id="v-notes" label={t("notes")} error={errors.notes?.message}>
            {(aria) => (
              <Textarea
                {...aria}
                rows={3}
                placeholder={t("notesPlaceholder")}
                {...form.register("notes")}
              />
            )}
          </FormField>
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("contract")}</p>
            <Controller
              control={form.control}
              name="contract"
              render={({ field }) => (
                <FileField
                  weddingId={weddingId}
                  folder="contracts"
                  value={field.value}
                  onChange={field.onChange}
                  disabled={!canEdit}
                  label={t("uploadContract")}
                />
              )}
            />
          </div>
        </fieldset>

        {vendor && (vendor.email || vendor.phone || vendor.website || vendor.instagram) && (
          <div className="flex flex-wrap gap-2">
            {vendor.email && (
              <Button asChild variant="outline" size="sm">
                <a href={`mailto:${vendor.email}`}>
                  <Mail aria-hidden /> {t("email")}
                </a>
              </Button>
            )}
            {vendor.phone && (
              <Button asChild variant="outline" size="sm">
                <a href={`tel:${vendor.phone.replace(/\s+/g, "")}`}>
                  <Phone aria-hidden /> {t("call")}
                </a>
              </Button>
            )}
            {vendor.website && (
              <Button asChild variant="outline" size="sm">
                <a href={vendor.website} target="_blank" rel="noreferrer">
                  <Globe aria-hidden /> {t("website")}
                </a>
              </Button>
            )}
            {vendor.instagram && (
              <Button asChild variant="outline" size="sm">
                <a
                  href={`https://instagram.com/${vendor.instagram}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <AtSign aria-hidden /> {t("instagram")}
                </a>
              </Button>
            )}
          </div>
        )}

        {vendor && (
          <section className="space-y-2 border-t pt-4">
            <h3 className="text-xl">{t("inYourBudget")}</h3>
            {linked.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("notLinked")}</p>
            ) : (
              <ul className="divide-y text-sm">
                {linked.map((e) => (
                  <li key={e.id} className="flex justify-between gap-2 py-1.5">
                    <span>{e.name}</span>
                    <span className="tabular-nums">
                      {t("linkedLine", { committed: money(committedCost(e)), paid: money(e.paid) })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              {canEdit && vendor.quote != null && linked.length === 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await addQuoteToBudget(vendor.id);
                      if (r.ok) toast.success(t("addedToBudget"));
                      else toast.error(r.error);
                    })
                  }
                >
                  <WalletCards aria-hidden /> {t("addQuote", { amount: money(vendor.quote) })}
                </Button>
              )}
              <Button asChild variant="ghost" size="sm">
                <Link href="/app/budget">{t("openBudget")}</Link>
              </Button>
            </div>
          </section>
        )}
      </form>

      {canEdit && (
        <SheetFooter className="flex-row flex-wrap items-center gap-2 border-t px-6 py-4">
          {vendor && (
            <ConfirmDialog
              trigger={
                <Button variant="ghost" className="text-destructive me-auto" disabled={pending}>
                  <Trash2 aria-hidden /> {t("delete")}
                </Button>
              }
              title={t("deleteTitle", { name: vendor.name })}
              description={t("deleteText")}
              onConfirm={async () => {
                const r = await deleteVendor(vendor.id);
                if (!r.ok) {
                  toast.error(r.error);
                  return false;
                }
                onClose();
              }}
            />
          )}
          <div className="ms-auto flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={pending}>
              {t("cancel")}
            </Button>
            <Button type="submit" form="vendor-form" disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              {vendor ? t("save") : t("add")}
            </Button>
          </div>
        </SheetFooter>
      )}
    </>
  );
}

function FindVendorsDropdown({
  location,
  category,
}: {
  location: string;
  category: string | null;
}) {
  const t = useTranslations("vendors");
  const label = category ?? "wedding vendors";
  const links = vendorSearchLinks(label, location);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Search aria-hidden /> {t("find")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="end">
        <p className="text-muted-foreground px-2 py-1 text-xs">{t("findHint", { location })}</p>
        <a
          href={links.google}
          target="_blank"
          rel="noreferrer"
          className="hover:bg-accent flex items-center gap-2 rounded px-2 py-1.5 text-sm"
        >
          <Globe className="size-4" aria-hidden /> Google Maps
          <ExternalLink className="text-muted-foreground ml-auto size-3" aria-hidden />
        </a>
        {links.theKnot && (
          <a
            href={links.theKnot}
            target="_blank"
            rel="noreferrer"
            className="hover:bg-accent flex items-center gap-2 rounded px-2 py-1.5 text-sm"
          >
            <Store className="size-4" aria-hidden /> The Knot
            <ExternalLink className="text-muted-foreground ml-auto size-3" aria-hidden />
          </a>
        )}
        {links.tripAdvisor && (
          <a
            href={links.tripAdvisor}
            target="_blank"
            rel="noreferrer"
            className="hover:bg-accent flex items-center gap-2 rounded px-2 py-1.5 text-sm"
          >
            <Store className="size-4" aria-hidden /> TripAdvisor
            <ExternalLink className="text-muted-foreground ml-auto size-3" aria-hidden />
          </a>
        )}
      </PopoverContent>
    </Popover>
  );
}
