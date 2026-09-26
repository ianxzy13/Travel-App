import type { Metadata } from "next";
import { Wallet } from "lucide-react";
import { ComingSoon } from "@/components/app/coming-soon";

export const metadata: Metadata = { title: "Budget" };

export default function BudgetPage() {
  return (
    <ComingSoon
      title="Budget"
      description="Know where every penny goes."
      icon={Wallet}
      phase={5}
      features={[
        "Categories with suggested amounts",
        "Expenses, deposits and due dates",
        "Receipts and charts",
        "CSV export",
      ]}
    />
  );
}
