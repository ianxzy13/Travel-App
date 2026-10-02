import "server-only";
import { getLocale } from "next-intl/server";
import type { VendorStatus } from "@/lib/database.types";
import { starterTexts } from "@/lib/i18n/defaults";
import { fetchAll } from "@/lib/supabase/fetch-all";
import type { createClient } from "@/lib/supabase/server";
import type { BudgetCategory, BudgetExpense, BudgetPayment } from "./stats";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type VendorSummary = {
  id: string;
  name: string;
  categoryId: string | null;
  status: VendorStatus;
  quote: number | null;
};

export type BudgetData = {
  categories: BudgetCategory[];
  expenses: BudgetExpense[];
  payments: BudgetPayment[];
  vendors: VendorSummary[];
};

const num = (v: unknown) => (v == null ? null : Number(v));

/** Budget rows for one wedding, with money converted to numbers. */
export async function loadBudget(sb: Supabase, weddingId: string): Promise<BudgetData> {
  const [categories, expenses, payments, vendors] = await Promise.all([
    fetchAll((f, t) =>
      sb
        .from("budget_categories")
        .select("*")
        .eq("wedding_id", weddingId)
        .order("sort_order")
        .order("name")
        .range(f, t),
    ),
    fetchAll((f, t) =>
      sb.from("expenses").select("*").eq("wedding_id", weddingId).order("created_at").range(f, t),
    ),
    fetchAll((f, t) =>
      sb
        .from("payments")
        .select("*")
        .eq("wedding_id", weddingId)
        .order("due_date", { nullsFirst: false })
        .order("created_at")
        .range(f, t),
    ),
    fetchAll((f, t) =>
      sb
        .from("vendors")
        .select("id, name, category_id, status, quote")
        .eq("wedding_id", weddingId)
        .order("name")
        .range(f, t),
    ),
  ]);

  // suggested categories nobody has renamed are shown in the viewer's language
  const shown = await starterTexts(await getLocale());
  return {
    categories: categories.map((c) => ({
      id: c.id,
      name: shown(c.name, "budget.suggested"),
      allocated: Number(c.allocated),
      sortOrder: c.sort_order,
    })),
    expenses: expenses.map((e) => ({
      id: e.id,
      categoryId: e.category_id,
      vendorId: e.vendor_id,
      name: e.name,
      estimated: Number(e.estimated),
      actual: num(e.actual),
      notes: e.notes,
      receiptPath: e.receipt_path,
      receiptName: e.receipt_name,
    })),
    payments: payments.map((p) => ({
      id: p.id,
      expenseId: p.expense_id,
      amount: Number(p.amount),
      dueDate: p.due_date,
      paid: p.paid,
      paidOn: p.paid_on,
      note: p.note,
    })),
    vendors: vendors.map((v) => ({
      id: v.id,
      name: v.name,
      categoryId: v.category_id,
      status: v.status,
      quote: num(v.quote),
    })),
  };
}
