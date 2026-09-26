import { fromCents, toCents } from "./money";

export type BudgetExpense = {
  id: string;
  categoryId: string;
  vendorId: string | null;
  name: string;
  estimated: number;
  actual: number | null;
  notes: string | null;
  receiptPath: string | null;
  receiptName: string | null;
};

export type BudgetPayment = {
  id: string;
  expenseId: string;
  amount: number;
  dueDate: string | null;
  paid: boolean;
  paidOn: string | null;
  note: string | null;
};

export type BudgetCategory = { id: string; name: string; allocated: number; sortOrder: number };

/** The cost we count for an expense: the actual price once known, else the estimate. */
export const committedCost = (e: Pick<BudgetExpense, "estimated" | "actual">) =>
  e.actual ?? e.estimated;

export type Totals = {
  allocated: number;
  estimated: number;
  actual: number;
  /** actual where known, otherwise estimated */
  committed: number;
  paid: number;
  /** committed − paid: what's still to pay */
  outstanding: number;
};

function totalsFor(
  expenses: BudgetExpense[],
  payments: BudgetPayment[],
  allocated: number,
): Totals {
  const ids = new Set(expenses.map((e) => e.id));
  let est = 0;
  let act = 0;
  let com = 0;
  let paid = 0;
  for (const e of expenses) {
    est += toCents(e.estimated);
    act += toCents(e.actual);
    com += toCents(committedCost(e));
  }
  for (const p of payments) if (p.paid && ids.has(p.expenseId)) paid += toCents(p.amount);
  return {
    allocated,
    estimated: fromCents(est),
    actual: fromCents(act),
    committed: fromCents(com),
    paid: fromCents(paid),
    outstanding: fromCents(Math.max(0, com - paid)),
  };
}

export type CategorySummary = BudgetCategory & {
  totals: Totals;
  /** committed − allocated (positive = over budget) */
  over: number;
  expenses: BudgetExpense[];
};

export type BudgetSummary = {
  total: number | null;
  categories: CategorySummary[];
  totals: Totals;
  /** total budget − allocated to categories */
  unallocated: number | null;
  /** total budget − committed */
  remaining: number | null;
};

export function summarizeBudget(
  total: number | null,
  categories: BudgetCategory[],
  expenses: BudgetExpense[],
  payments: BudgetPayment[],
): BudgetSummary {
  const summaries = [...categories]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map((c) => {
      const own = expenses.filter((e) => e.categoryId === c.id);
      const totals = totalsFor(own, payments, c.allocated);
      return {
        ...c,
        expenses: own,
        totals,
        over: fromCents(toCents(totals.committed) - toCents(c.allocated)),
      };
    });
  const allocated = fromCents(categories.reduce((n, c) => n + toCents(c.allocated), 0));
  const totals = totalsFor(expenses, payments, allocated);
  return {
    total,
    categories: summaries,
    totals,
    unallocated: total == null ? null : fromCents(toCents(total) - toCents(allocated)),
    remaining: total == null ? null : fromCents(toCents(total) - toCents(totals.committed)),
  };
}

export type UpcomingPayment = BudgetPayment & {
  expenseName: string;
  categoryName: string;
  overdue: boolean;
  /** days from today (negative = overdue) */
  days: number;
};

/** Unpaid payments with a due date, soonest first. `today` is "YYYY-MM-DD". */
export function upcomingPayments(
  payments: BudgetPayment[],
  expenses: BudgetExpense[],
  categories: BudgetCategory[],
  today: string,
): UpcomingPayment[] {
  const expense = new Map(expenses.map((e) => [e.id, e]));
  const category = new Map(categories.map((c) => [c.id, c.name]));
  const dayMs = 86_400_000;
  const t0 = Date.parse(`${today}T00:00:00Z`);
  return payments
    .filter((p) => !p.paid && p.dueDate)
    .map((p) => {
      const e = expense.get(p.expenseId);
      const days = Math.round((Date.parse(`${p.dueDate}T00:00:00Z`) - t0) / dayMs);
      return {
        ...p,
        expenseName: e?.name ?? "",
        categoryName: e ? (category.get(e.categoryId) ?? "") : "",
        overdue: days < 0,
        days,
      };
    })
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));
}

/** Top categories for the donut: the biggest `max` plus everything else as "Other". */
export function donutSlices(summary: BudgetSummary, max = 7) {
  const withSpend = summary.categories
    .filter((c) => c.totals.committed > 0)
    .sort((a, b) => b.totals.committed - a.totals.committed);
  const top = withSpend
    .slice(0, max)
    .map((c) => ({ id: c.id, name: c.name, value: c.totals.committed }));
  const rest = withSpend.slice(max);
  if (rest.length) {
    top.push({
      id: "other",
      name: `Other (${rest.length})`,
      value: fromCents(rest.reduce((n, c) => n + toCents(c.totals.committed), 0)),
    });
  }
  return top;
}
