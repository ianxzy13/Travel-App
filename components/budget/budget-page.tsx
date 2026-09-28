"use client";

import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ChevronDown,
  Download,
  Loader2,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Wallet,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  addSuggestedCategories,
  deleteCategory,
  saveCategory,
  setBudgetTotal,
  setPaymentPaid,
} from "@/app/app/budget/actions";
import { PageHeader } from "@/components/app/page-header";
import { ConfirmDialog } from "@/components/confirm-dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BudgetData } from "@/lib/budget/load";
import { formatMoney } from "@/lib/budget/money";
import {
  committedCost,
  summarizeBudget,
  upcomingPayments,
  type BudgetCategory,
  type CategorySummary,
} from "@/lib/budget/stats";
import { fmtDate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import { ExpenseSheet, type ExpenseSheetMode } from "./expense-sheet";
import { MoneyInput } from "./money-input";

// The charts library is large, so it's only downloaded when the charts are shown.
const BudgetCharts = dynamic(() => import("./budget-charts").then((m) => m.BudgetCharts), {
  ssr: false,
  loading: () => <div className="bg-muted h-72 animate-pulse rounded-xl" aria-hidden />,
});

type Props = BudgetData & {
  weddingId: string;
  total: number | null;
  currency: string;
  canEdit: boolean;
  today: string;
};

export function BudgetPage(props: Props) {
  const { currency, canEdit } = props;
  const t = useTranslations("budget");
  const summary = summarizeBudget(props.total, props.categories, props.expenses, props.payments);
  const upcoming = upcomingPayments(props.payments, props.expenses, props.categories, props.today);
  const money = (v: number) => formatMoney(v, currency);

  const [sheet, setSheet] = useState<ExpenseSheetMode>(null);
  const [categoryDialog, setCategoryDialog] = useState<BudgetCategory | "new" | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const toggle = (id: string) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const actions = (
    <>
      {props.expenses.length > 0 && (
        <Button asChild variant="outline" size="sm">
          <a href="/app/budget/export" download>
            <Download aria-hidden /> {t("exportCsv")}
          </a>
        </Button>
      )}
      {canEdit && props.categories.length > 0 && (
        <>
          <Button variant="outline" size="sm" onClick={() => setCategoryDialog("new")}>
            <Plus aria-hidden /> {t("category")}
          </Button>
          <Button size="sm" onClick={() => setSheet({ kind: "new" })}>
            <Plus aria-hidden /> {t("expense")}
          </Button>
        </>
      )}
    </>
  );

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} actions={actions} />

      <div className="space-y-6">
        <SummaryTiles summary={summary} currency={currency} canEdit={canEdit} />

        {props.categories.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <span className="bg-primary-soft text-primary-ink inline-flex size-14 items-center justify-center rounded-full">
                <Wallet className="size-7" aria-hidden />
              </span>
              <h2 className="text-3xl">{t("startTitle")}</h2>
              <p className="text-muted-foreground max-w-md">
                {summary.total ? t("startWithTotal") : t("startNoTotal")}
              </p>
              {canEdit && (
                <div className="flex flex-wrap justify-center gap-2">
                  <Button
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const r = await addSuggestedCategories();
                        if (!r.ok) toast.error(r.error);
                      })
                    }
                  >
                    {pending ? (
                      <Loader2 className="animate-spin" aria-hidden />
                    ) : (
                      <Sparkles aria-hidden />
                    )}
                    {t("useSuggested")}
                  </Button>
                  <Button variant="outline" onClick={() => setCategoryDialog("new")}>
                    {t("fromScratch")}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <BudgetCharts summary={summary} currency={currency} />

            <UpcomingPayments list={upcoming} currency={currency} canEdit={canEdit} />

            <section aria-labelledby="categories-title" className="space-y-3">
              <h2 id="categories-title" className="text-3xl">
                {t("categories")}
              </h2>
              <ul className="space-y-2">
                {summary.categories.map((c) => (
                  <CategoryRow
                    key={c.id}
                    category={c}
                    currency={currency}
                    open={open.has(c.id)}
                    onToggle={() => toggle(c.id)}
                    canEdit={canEdit}
                    vendors={props.vendors}
                    payments={props.payments}
                    today={props.today}
                    onEditExpense={(e) => setSheet({ kind: "edit", expense: e })}
                    onAddExpense={() => setSheet({ kind: "new", categoryId: c.id })}
                    onEditCategory={() => setCategoryDialog(c)}
                  />
                ))}
              </ul>
              {summary.unallocated != null && summary.unallocated !== 0 && (
                <p
                  className={cn(
                    "text-sm",
                    summary.unallocated < 0 ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {summary.unallocated > 0
                    ? t("unallocated", { amount: money(summary.unallocated) })
                    : t("overAllocated", { amount: money(-summary.unallocated) })}
                </p>
              )}
            </section>
          </>
        )}
      </div>

      <ExpenseSheet
        mode={sheet}
        onClose={() => setSheet(null)}
        weddingId={props.weddingId}
        currency={currency}
        categories={props.categories}
        vendors={props.vendors}
        payments={props.payments}
        readOnly={!canEdit}
      />
      <CategoryDialog
        value={categoryDialog}
        currency={currency}
        onClose={() => setCategoryDialog(null)}
      />
    </>
  );
}

// ---------------------------------------------------------------------------

function SummaryTiles({
  summary,
  currency,
  canEdit,
}: {
  summary: ReturnType<typeof summarizeBudget>;
  currency: string;
  canEdit: boolean;
}) {
  const t = useTranslations("budget");
  const money = (v: number) => formatMoney(v, currency);
  const { totals, total, remaining } = summary;
  const base = Math.max(total ?? 0, totals.committed, 1);
  const pct = (v: number) => `${Math.min(100, (v / base) * 100)}%`;

  return (
    <Card>
      <CardContent className="space-y-5 p-5 sm:p-6">
        <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div>
            <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {t("total")}
            </dt>
            <dd className="flex items-center gap-1">
              <span className="font-serif text-3xl font-medium tabular-nums sm:text-4xl">
                {total == null ? t("notSet") : money(total)}
              </span>
              {canEdit && <TotalEditor total={total} currency={currency} />}
            </dd>
          </div>
          <Tile label={t("committed")} value={money(totals.committed)} hint={t("committedHint")} />
          <Tile
            label={t("paid")}
            value={money(totals.paid)}
            hint={t("toPay", { amount: money(totals.outstanding) })}
          />
          <div>
            <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {t("remaining")}
            </dt>
            <dd>
              <span
                className={cn(
                  "font-serif text-3xl font-medium tabular-nums sm:text-4xl",
                  remaining != null && remaining < 0 && "text-destructive",
                )}
              >
                {remaining == null ? "–" : money(remaining)}
              </span>
              {remaining != null && remaining < 0 && (
                <span className="text-destructive flex items-center gap-1 text-xs">
                  <AlertTriangle className="size-3.5" aria-hidden /> {t("overBudget")}
                </span>
              )}
            </dd>
          </div>
        </dl>
        {/* paid | committed but unpaid | free */}
        <div>
          <div
            className="bg-muted flex h-3 overflow-hidden rounded-full"
            role="img"
            aria-label={
              total != null
                ? t("barLabelOf", {
                    paid: money(totals.paid),
                    committed: money(totals.committed),
                    total: money(total),
                  })
                : t("barLabel", { paid: money(totals.paid), committed: money(totals.committed) })
            }
          >
            <div className="bg-primary" style={{ width: pct(totals.paid) }} />
            <div
              className="bg-primary/40 border-card border-s-2"
              style={{ width: pct(Math.max(0, totals.committed - totals.paid)) }}
            />
          </div>
          <ul className="text-muted-foreground mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <li className="flex items-center gap-1.5">
              <span className="bg-primary size-2.5 rounded-sm" aria-hidden /> {t("legendPaid")}
            </li>
            <li className="flex items-center gap-1.5">
              <span className="bg-primary/40 size-2.5 rounded-sm" aria-hidden />{" "}
              {t("legendCommitted")}
            </li>
            <li className="flex items-center gap-1.5">
              <span className="bg-muted size-2.5 rounded-sm border" aria-hidden /> {t("legendFree")}
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</dt>
      <dd>
        <span className="font-serif text-3xl font-medium tabular-nums sm:text-4xl">{value}</span>
        {hint && <span className="text-muted-foreground block text-xs">{hint}</span>}
      </dd>
    </div>
  );
}

function TotalEditor({ total, currency }: { total: number | null; currency: string }) {
  const t = useTranslations("budget");
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<number | null>(total);
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => {
          setValue(total);
          setOpen(true);
        }}
        aria-label={t("changeTotal")}
      >
        <Pencil aria-hidden />
      </Button>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{t("total")}</DialogTitle>
          <DialogDescription>{t("totalHint")}</DialogDescription>
        </DialogHeader>
        <MoneyInput
          currency={currency}
          allowEmpty
          value={value}
          onChange={setValue}
          aria-label={t("total")}
          autoFocus
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("cancel")}
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await setBudgetTotal(value);
                if (r.ok) setOpen(false);
                else toast.error(r.error);
              })
            }
          >
            {pending && <Loader2 className="animate-spin" aria-hidden />} {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UpcomingPayments({
  list,
  currency,
  canEdit,
}: {
  list: ReturnType<typeof upcomingPayments>;
  currency: string;
  canEdit: boolean;
}) {
  const t = useTranslations("budget");
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  if (list.length === 0) return null;
  const shown = list.slice(0, 8);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-serif text-2xl">
          <CalendarClock className="text-primary-ink size-5" aria-hidden /> {t("upcoming")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {shown.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
              <span
                className={cn(
                  "w-28 shrink-0 tabular-nums",
                  p.overdue && "text-destructive font-medium",
                )}
              >
                {p.overdue && (
                  <AlertTriangle className="me-1 inline size-3.5" aria-label={t("overdue")} />
                )}
                {fmtDate(p.dueDate!, locale, "medium")}
              </span>
              <span className="min-w-40 flex-1">
                {p.expenseName}
                <span className="text-muted-foreground">
                  {" "}
                  · {p.categoryName}
                  {p.note ? ` · ${p.note}` : ""}
                </span>
              </span>
              <span className="font-medium tabular-nums">{formatMoney(p.amount, currency)}</span>
              <span
                className={cn(
                  "w-24 text-end text-xs",
                  p.overdue ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {p.overdue
                  ? t("daysOverdue", { count: -p.days })
                  : p.days === 0
                    ? t("dueToday")
                    : t("inDays", { count: p.days })}
              </span>
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await setPaymentPaid(p.id, true);
                      if (r.ok)
                        toast.success(t("markedPaid", { amount: formatMoney(p.amount, currency) }));
                      else toast.error(r.error);
                    })
                  }
                >
                  <Check aria-hidden /> {t("markPaid")}
                </Button>
              )}
            </li>
          ))}
        </ul>
        {list.length > shown.length && (
          <p className="text-muted-foreground mt-2 text-xs">
            {t("andMore", { count: list.length - shown.length })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function CategoryRow({
  category: c,
  currency,
  open,
  onToggle,
  canEdit,
  vendors,
  payments,
  today,
  onEditExpense,
  onAddExpense,
  onEditCategory,
}: {
  category: CategorySummary;
  currency: string;
  open: boolean;
  onToggle: () => void;
  canEdit: boolean;
  vendors: BudgetData["vendors"];
  payments: BudgetData["payments"];
  today: string;
  onEditExpense: (e: CategorySummary["expenses"][number]) => void;
  onAddExpense: () => void;
  onEditCategory: () => void;
}) {
  const t = useTranslations("budget");
  const locale = useLocale();
  const money = (v: number) => formatMoney(v, currency);
  const over = c.allocated > 0 && c.over > 0;
  const fill =
    c.allocated > 0
      ? Math.min(100, (c.totals.committed / c.allocated) * 100)
      : c.totals.committed > 0
        ? 100
        : 0;
  const vendorName = new Map(vendors.map((v) => [v.id, v.name]));
  const panelId = `cat-${c.id}`;

  return (
    <li className="bg-card rounded-xl border">
      <div className="flex items-center gap-2 p-3 sm:p-4">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="focus-visible:ring-ring flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2 rounded text-start focus-visible:ring-2 focus-visible:outline-none"
        >
          <ChevronDown
            className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")}
            aria-hidden
          />
          <span className="min-w-32 flex-1">
            <span className="block font-medium">{c.name}</span>
            <span className="text-muted-foreground text-xs">
              {t("expenses", { count: c.expenses.length })}
              {c.totals.paid > 0 && t("paidAmount", { amount: money(c.totals.paid) })}
            </span>
          </span>
          <span className="w-full max-w-64 min-w-40 flex-1 sm:w-auto">
            <span className="flex justify-between text-xs tabular-nums">
              <span className={cn(over && "text-destructive font-medium")}>
                {money(c.totals.committed)}
              </span>
              <span className="text-muted-foreground">
                {t("of", { amount: money(c.allocated) })}
              </span>
            </span>
            <span className="bg-muted mt-1 block h-1.5 rounded-full">
              <span
                className={cn("block h-1.5 rounded-full", over ? "bg-destructive" : "bg-primary")}
                style={{ width: `${fill}%` }}
              />
            </span>
            {over && (
              <span className="text-destructive mt-0.5 flex items-center gap-1 text-xs">
                <AlertTriangle className="size-3" aria-hidden />{" "}
                {t("over", { amount: money(c.over) })}
              </span>
            )}
          </span>
        </button>
        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={t("optionsFor", { name: c.name })}>
                <MoreHorizontal aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onAddExpense}>
                <Plus aria-hidden /> {t("addExpense")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onEditCategory}>
                <Pencil aria-hidden /> {t("rename")}
              </DropdownMenuItem>
              <DeleteCategoryItem category={c} />
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {open && (
        <div id={panelId} className="border-t px-3 pb-3 sm:px-4">
          {c.expenses.length === 0 ? (
            <p className="text-muted-foreground py-4 text-sm">{t("noExpenses")}</p>
          ) : (
            <ul className="divide-y">
              {c.expenses.map((e) => {
                const own = payments.filter((p) => p.expenseId === e.id);
                const paid = own.filter((p) => p.paid).reduce((n, p) => n + p.amount, 0);
                const next = own
                  .filter((p) => !p.paid && p.dueDate)
                  .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))[0];
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => onEditExpense(e)}
                      className="hover:bg-accent focus-visible:ring-ring flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded px-1 py-2.5 text-start text-sm focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <span className="min-w-40 flex-1">
                        <span className="flex items-center gap-1.5 font-medium">
                          {e.name}
                          {e.receiptPath && (
                            <Paperclip
                              className="text-muted-foreground size-3.5"
                              aria-label={t("hasReceipt")}
                            />
                          )}
                        </span>
                        {e.vendorId && (
                          <span className="text-muted-foreground block text-xs">
                            {vendorName.get(e.vendorId)}
                          </span>
                        )}
                      </span>
                      <span className="text-end tabular-nums">
                        {money(committedCost(e))}
                        <span className="text-muted-foreground block text-xs">
                          {e.actual == null ? t("estimate") : t("actual")}
                        </span>
                      </span>
                      <span className="w-32 text-end text-xs tabular-nums">
                        {paid > 0 ? t("paidShort", { amount: money(paid) }) : t("nothingPaid")}
                        {next && (
                          <span
                            className={cn(
                              "block",
                              next.dueDate! < today ? "text-destructive" : "text-muted-foreground",
                            )}
                          >
                            {t("dueOn", {
                              amount: money(next.amount),
                              date: fmtDate(next.dueDate!, locale, "medium"),
                            })}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {canEdit && (
            <Button variant="ghost" size="sm" className="mt-1" onClick={onAddExpense}>
              <Plus aria-hidden /> {t("addExpense")}
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

function DeleteCategoryItem({ category: c }: { category: CategorySummary }) {
  const t = useTranslations("budget");
  return (
    <ConfirmDialog
      trigger={
        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
          <Trash2 aria-hidden /> {t("deleteCategory")}
        </DropdownMenuItem>
      }
      title={t("deleteCategoryTitle", { name: c.name })}
      description={t("deleteCategoryText", { count: c.expenses.length })}
      onConfirm={async () => {
        const r = await deleteCategory(c.id);
        if (!r.ok) {
          toast.error(r.error);
          return false;
        }
      }}
    />
  );
}

function CategoryDialog({
  value,
  currency,
  onClose,
}: {
  value: BudgetCategory | "new" | null;
  currency: string;
  onClose: () => void;
}) {
  const existing = value && value !== "new" ? value : null;
  return (
    <Dialog open={!!value} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        {value && (
          <CategoryForm
            key={existing?.id ?? "new"}
            existing={existing}
            currency={currency}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CategoryForm({
  existing,
  currency,
  onClose,
}: {
  existing: BudgetCategory | null;
  currency: string;
  onClose: () => void;
}) {
  const t = useTranslations("budget");
  const [name, setName] = useState(existing?.name ?? "");
  const [allocated, setAllocated] = useState<number | null>(existing?.allocated ?? 0);
  const [pending, startTransition] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await saveCategory({ name, allocated: allocated ?? 0 }, existing?.id);
          if (r.ok) onClose();
          else toast.error(r.error);
        });
      }}
      className="space-y-4"
    >
      <DialogHeader>
        <DialogTitle className="font-serif text-2xl">
          {existing ? t("editCategory") : t("newCategory")}
        </DialogTitle>
        <DialogDescription>{t("categoryHint")}</DialogDescription>
      </DialogHeader>
      <div className="space-y-1.5">
        <Label htmlFor="cat-name">{t("name")}</Label>
        <Input
          id="cat-name"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cat-amount">{t("planned")}</Label>
        <MoneyInput id="cat-amount" currency={currency} value={allocated} onChange={setAllocated} />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={pending || !name.trim()}>
          {pending && <Loader2 className="animate-spin" aria-hidden />} {t("save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
