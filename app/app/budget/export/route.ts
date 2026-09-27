import { format } from "date-fns";
import Papa from "papaparse";
import { getTranslations } from "next-intl/server";
import { loadBudget } from "@/lib/budget/load";
import { sumMoney } from "@/lib/budget/money";
import { summarizeBudget } from "@/lib/budget/stats";
import { safeCell } from "@/lib/guests/csv";
import { createClient } from "@/lib/supabase/server";
import { requireWedding } from "@/lib/wedding";

/** GET /app/budget/export → the budget as a CSV file (one row per expense). */
export async function GET() {
  const { wedding } = await requireWedding();
  const data = await loadBudget(await createClient(), wedding.id);
  const summary = summarizeBudget(null, data.categories, data.expenses, data.payments);
  const vendorName = new Map(data.vendors.map((v) => [v.id, v.name]));
  const n = (v: number | null) => (v == null ? "" : v.toFixed(2));
  const c = await getTranslations("budget.csv");

  const rows = summary.categories.flatMap((cat) =>
    (cat.expenses.length ? cat.expenses : [null]).map((e) => {
      const own = e ? data.payments.filter((p) => p.expenseId === e.id) : [];
      const paid = sumMoney(own.filter((p) => p.paid).map((p) => p.amount));
      const next = own
        .filter((p) => !p.paid && p.dueDate)
        .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))[0];
      return {
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
    }),
  );

  const safe = rows.map((r) =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k, safeCell(v)])),
  );
  const csv = "﻿" + Papa.unparse(safe, { newline: "\r\n" });
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${c("file")}-${format(new Date(), "yyyy-MM-dd")}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
