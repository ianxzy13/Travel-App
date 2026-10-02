import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { VendorsPage } from "@/components/vendors/vendors-page";
import { loadBudget } from "@/lib/budget/load";
import { sumMoney } from "@/lib/budget/money";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { canEdit, requireWedding } from "@/lib/wedding";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("app.nav"))("vendors") };
}

export default async function Vendors() {
  const { wedding, role } = await requireWedding();
  const sb = await createClient();
  const [vendors, budget] = await Promise.all([
    fetchAll((f, t) =>
      sb.from("vendors").select("*").eq("wedding_id", wedding.id).order("name").range(f, t),
    ),
    loadBudget(sb, wedding.id),
  ]);

  return (
    <VendorsPage
      vendors={vendors.map((v) => ({ ...v, quote: v.quote == null ? null : Number(v.quote) }))}
      categories={budget.categories.map((c) => ({ id: c.id, name: c.name }))}
      expenses={budget.expenses
        .filter((e) => e.vendorId)
        .map((e) => ({
          id: e.id,
          vendorId: e.vendorId!,
          name: e.name,
          estimated: e.estimated,
          actual: e.actual,
          paid: sumMoney(
            budget.payments.filter((p) => p.expenseId === e.id && p.paid).map((p) => p.amount),
          ),
        }))}
      weddingId={wedding.id}
      currency={wedding.currency}
      location={wedding.location}
      canEdit={canEdit(role)}
    />
  );
}
