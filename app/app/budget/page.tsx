import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BudgetPage } from "@/components/budget/budget-page";
import { loadBudget } from "@/lib/budget/load";
import { createClient } from "@/lib/supabase/server";
import { canEdit, requireWedding } from "@/lib/wedding";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("budget"))("title") };
}

export default async function Budget() {
  const { wedding, role } = await requireWedding();
  const data = await loadBudget(await createClient(), wedding.id);

  return (
    <BudgetPage
      {...data}
      weddingId={wedding.id}
      total={wedding.budget_total == null ? null : Number(wedding.budget_total)}
      currency={wedding.currency}
      canEdit={canEdit(role)}
      today={new Date().toISOString().slice(0, 10)}
    />
  );
}
