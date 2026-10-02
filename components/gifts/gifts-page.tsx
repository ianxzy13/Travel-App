"use client";

import { useMemo, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Check,
  Gift,
  Loader2,
  MailCheck,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { deleteGift, saveGift, toggleThankYou } from "@/app/app/gifts/actions";
import { PageHeader } from "@/components/app/page-header";
import { MoneyInput } from "@/components/budget/money-input";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { GiftRow } from "@/lib/database.types";
import { formatMoney } from "@/lib/budget/money";
import { normalize } from "@/lib/guests/filter";
import { cn } from "@/lib/utils";
import { GIFT_CATEGORIES, giftSchema, type GiftValues } from "@/lib/validation/gifts";

export type GiftItem = Omit<GiftRow, "amount"> & { amount: number | null };

type Props = {
  gifts: GiftItem[];
  households: { id: string; name: string }[];
  currency: string;
  canEdit: boolean;
};

export function GiftsPage({ gifts, households, currency, canEdit }: Props) {
  const t = useTranslations("app.gifts");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [tyFilter, setTyFilter] = useState<string>("all");
  const [editing, setEditing] = useState<GiftItem | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();

  const money = (n: number) => formatMoney(n, currency);

  const filtered = useMemo(() => {
    const q = normalize(search);
    return gifts.filter((g) => {
      if (q && !normalize(g.from_name).includes(q) && !normalize(g.description).includes(q))
        return false;
      if (catFilter !== "all" && g.category !== catFilter) return false;
      if (tyFilter === "sent" && !g.thank_you_sent) return false;
      if (tyFilter === "pending" && g.thank_you_sent) return false;
      return true;
    });
  }, [gifts, search, catFilter, tyFilter]);

  const totalValue = gifts.reduce((s, g) => s + (g.amount ?? 0), 0);
  const thankYouDone = gifts.filter((g) => g.thank_you_sent).length;

  const handleToggleThankYou = (id: string, sent: boolean) => {
    startTransition(async () => {
      const r = await toggleThankYou(id, sent);
      if (!r.ok) toast.error(r.error);
    });
  };

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          canEdit && (
            <Button onClick={() => setAdding(true)}>
              <Plus aria-hidden /> {t("add")}
            </Button>
          )
        }
      />

      {gifts.length > 0 && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <StatCard label={t("stats.total")} value={String(gifts.length)} />
          <StatCard
            label={t("stats.totalValue")}
            value={totalValue > 0 ? money(totalValue) : "—"}
          />
          <StatCard
            label={t("stats.thankYou")}
            value={`${thankYouDone} / ${gifts.length}`}
            progress={gifts.length > 0 ? (thankYouDone / gifts.length) * 100 : 0}
          />
        </div>
      )}

      {gifts.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2" />
            <Input
              placeholder={t("search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ps-9"
            />
          </div>
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="w-auto min-w-[10rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filter.allCategories")}</SelectItem>
              {GIFT_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {t(`category.${c}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={tyFilter} onValueChange={setTyFilter}>
            <SelectTrigger className="w-auto min-w-[10rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filter.allThankYou")}</SelectItem>
              <SelectItem value="sent">{t("filter.sent")}</SelectItem>
              <SelectItem value="pending">{t("filter.pending")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {gifts.length === 0 ? (
        <div className="bg-muted/40 rounded-lg px-6 py-16 text-center">
          <Gift className="text-muted-foreground mx-auto mb-4 size-12" aria-hidden />
          <p className="text-xl font-medium">{t("emptyTitle")}</p>
          <p className="text-muted-foreground mt-1">{t("emptyText")}</p>
          {canEdit && (
            <Button className="mt-4" onClick={() => setAdding(true)}>
              <Plus aria-hidden /> {t("addFirst")}
            </Button>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">{t("noResults")}</p>
      ) : (
        <div className="divide-y rounded-lg border">
          {filtered.map((g) => (
            <div
              key={g.id}
              className={cn(
                "flex items-center gap-3 px-4 py-3",
                canEdit && "cursor-pointer hover:bg-accent",
              )}
              onClick={() => canEdit && setEditing(g)}
            >
              <button
                type="button"
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded border transition-colors",
                  g.thank_you_sent
                    ? "bg-primary border-primary text-primary-foreground"
                    : "border-input hover:border-primary",
                )}
                aria-label={t("toggleThankYou")}
                onClick={(e) => {
                  e.stopPropagation();
                  if (canEdit) handleToggleThankYou(g.id, !g.thank_you_sent);
                }}
              >
                {g.thank_you_sent && <Check className="size-4" />}
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{g.description}</p>
                <p className="text-muted-foreground truncate text-sm">
                  {t("from")} {g.from_name}
                  {g.received_on && <span> · {g.received_on}</span>}
                </p>
              </div>
              <span className="text-muted-foreground text-xs">
                {t(`category.${g.category}`)}
              </span>
              {g.amount != null && (
                <span className="shrink-0 tabular-nums font-medium">{money(g.amount)}</span>
              )}
              {g.thank_you_sent && (
                <MailCheck className="text-success size-4 shrink-0" aria-hidden />
              )}
            </div>
          ))}
        </div>
      )}

      <GiftSheet
        open={adding || !!editing}
        gift={editing}
        households={households}
        currency={currency}
        onClose={() => {
          setAdding(false);
          setEditing(null);
        }}
      />
    </>
  );
}

function StatCard({
  label,
  value,
  progress,
}: {
  label: string;
  value: string;
  progress?: number;
}) {
  return (
    <div className="bg-card rounded-lg border p-4">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="font-serif text-3xl font-medium tabular-nums">{value}</p>
      {progress != null && (
        <div className="bg-muted mt-2 h-1.5 rounded-full">
          <div
            className="bg-primary h-1.5 rounded-full transition-all"
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function GiftSheet({
  open,
  gift,
  households,
  currency,
  onClose,
}: {
  open: boolean;
  gift: GiftItem | null;
  households: { id: string; name: string }[];
  currency: string;
  onClose: () => void;
}) {
  const t = useTranslations("app.gifts");
  const [pending, startTransition] = useTransition();

  const form = useForm<GiftValues>({
    resolver: zodResolver(giftSchema),
    values: gift
      ? {
          description: gift.description,
          amount: gift.amount,
          householdId: gift.household_id,
          fromName: gift.from_name,
          category: gift.category,
          receivedOn: gift.received_on ?? "",
          thankYouSent: gift.thank_you_sent,
          thankYouSentOn: gift.thank_you_sent_on ?? "",
          notes: gift.notes ?? "",
        }
      : {
          description: "",
          amount: null,
          householdId: null,
          fromName: "",
          category: "other",
          receivedOn: "",
          thankYouSent: false,
          thankYouSentOn: "",
          notes: "",
        },
  });

  const onSubmit = form.handleSubmit((v) =>
    startTransition(async () => {
      const r = await saveGift(v, gift?.id);
      if (r.ok) {
        toast.success(t(gift ? "saved" : "added"));
        onClose();
      } else {
        toast.error(r.error);
      }
    }),
  );

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{gift ? t("editTitle") : t("addTitle")}</SheetTitle>
          <SheetDescription>{t("formHint")}</SheetDescription>
        </SheetHeader>
        <form onSubmit={onSubmit} className="mt-6 space-y-5">
          <FormField id="g-desc" label={t("field.description")} error={form.formState.errors.description?.message}>
            {(aria) => <Input {...aria} {...form.register("description")} />}
          </FormField>

          <FormField id="g-from" label={t("field.fromName")} error={form.formState.errors.fromName?.message}>
            {(aria) => <Input {...aria} {...form.register("fromName")} />}
          </FormField>

          <FormField id="g-household" label={t("field.household")}>
            {(aria) => (
              <Controller
                control={form.control}
                name="householdId"
                render={({ field }) => (
                  <Select
                    value={field.value ?? "__none__"}
                    onValueChange={(v) => {
                      const id = v === "__none__" ? null : v;
                      field.onChange(id);
                      if (id) {
                        const h = households.find((h) => h.id === id);
                        if (h && !form.getValues("fromName")) form.setValue("fromName", h.name);
                      }
                    }}
                  >
                    <SelectTrigger {...aria}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{t("field.noHousehold")}</SelectItem>
                      {households.map((h) => (
                        <SelectItem key={h.id} value={h.id}>
                          {h.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField id="g-amount" label={t("field.amount")}>
              {(aria) => (
                <Controller
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <MoneyInput
                      {...aria}
                      value={field.value}
                      onChange={field.onChange}
                      currency={currency}
                      placeholder="0"
                    />
                  )}
                />
              )}
            </FormField>

            <FormField id="g-cat" label={t("field.category")}>
              {(aria) => (
                <Controller
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger {...aria}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GIFT_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {t(`category.${c}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </FormField>
          </div>

          <FormField id="g-received" label={t("field.receivedOn")}>
            {(aria) => <Input {...aria} type="date" {...form.register("receivedOn")} />}
          </FormField>

          <div className="flex items-center gap-2">
            <Controller
              control={form.control}
              name="thankYouSent"
              render={({ field }) => (
                <Checkbox
                  id="thankYouSent"
                  checked={field.value}
                  onCheckedChange={(v) => {
                    field.onChange(!!v);
                    if (v && !form.getValues("thankYouSentOn")) {
                      form.setValue("thankYouSentOn", new Date().toISOString().slice(0, 10));
                    }
                  }}
                />
              )}
            />
            <label htmlFor="thankYouSent" className="text-sm">
              {t("field.thankYouSent")}
            </label>
          </div>

          {form.watch("thankYouSent") && (
            <FormField id="g-ty-date" label={t("field.thankYouSentOn")}>
              {(aria) => <Input {...aria} type="date" {...form.register("thankYouSentOn")} />}
            </FormField>
          )}

          <FormField id="g-notes" label={t("field.notes")}>
            {(aria) => <Textarea {...aria} {...form.register("notes")} rows={3} />}
          </FormField>

          <SheetFooter className="gap-2">
            {gift && (
              <ConfirmDialog
                trigger={
                  <Button type="button" variant="destructive" size="icon">
                    <Trash2 aria-hidden />
                    <span className="sr-only">{t("delete")}</span>
                  </Button>
                }
                title={t("deleteTitle")}
                description={t("deleteText")}
                onConfirm={async () => {
                  const r = await deleteGift(gift.id);
                  if (r.ok) {
                    toast.success(t("deleted"));
                    onClose();
                  } else {
                    toast.error(r.error);
                  }
                }}
              />
            )}
            <Button type="submit" disabled={pending} className="flex-1">
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              {t("save")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
