import { format } from "date-fns";
import { getTranslations } from "next-intl/server";
import { loadBudget } from "@/lib/budget/load";
import { sumMoney } from "@/lib/budget/money";
import { summarizeBudget } from "@/lib/budget/stats";
import { createClient } from "@/lib/supabase/server";
import { requireWedding } from "@/lib/wedding";
import { type Cell, xlsxResponse } from "@/lib/xlsx/build";

/** GET /app/budget/export → the budget as an Excel file (one row per expense). */
export async function GET() {
  const { wedding } = await requireWedding();
  const data = await loadBudget(await createClient(), wedding.id);
  const summary = summarizeBudget(null, data.categories, data.expenses, data.payments);
  const vendorName = new Map(data.vendors.map((v) => [v.id, v.name]));
  // amounts stay numbers, so Excel can add them up
  const n = (v: number | null): Cell => (v == null ? "" : Math.round(v * 100) / 100);
  const c = await getTranslations("budget.csv");
  const title = (await getTranslations("budget"))("title");

  const rows = summary.categories.flatMap((cat) =>
    (cat.expenses.length ? cat.expenses : [null]).map((e) => {
      const own = e ? data.payments.filter((p) => p.expenseId === e.id) : [];
      const paid = sumMoney(own.filter((p) => p.paid).map((p) => p.amount));
      const next = own
        .filter((p) => !p.paid && p.dueDate)
        .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))[0];
      const row: Record<string, Cell> = {
        [c("category")]: cat.name,
        [c("planned")]: n(cat.allocated),
        [c("expense")]: e?.name ?? "",
        [c("vendor")]: e?.vendorId ? (vendorName.get(e.vendorId) ?? "") : "",
        [c("estimated")]: e ? n(e.estimated) : "",
        [c("actual")]: e ? n(e.actual) : "",
        [c("paid")]: e ? n(paid) : "",
        [c("nextDue")]: next?.dueDate ?? "",
        [c("nextAmount")]: next ? n(next.amount) : "",
        [c("currency")]: wedding.currency,
        [c("notes")]: e?.notes ?? "",
      };
      return row;
    }),
  );

  const header = [
    c("category"),
    c("planned"),
    c("expense"),
    c("vendor"),
    c("estimated"),
    c("actual"),
    c("paid"),
    c("nextDue"),
    c("nextAmount"),
    c("currency"),
    c("notes"),
  ];
  return xlsxResponse(`${c("file")}-${format(new Date(), "yyyy-MM-dd")}.xlsx`, title, [
    header,
    ...rows.map((r) => header.map((h) => r[h])),
  ]);
}
