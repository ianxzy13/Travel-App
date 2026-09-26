import type { Metadata } from "next";
import { Users } from "lucide-react";
import { ComingSoon } from "@/components/app/coming-soon";

export const metadata: Metadata = { title: "Guests" };

export default function GuestsPage() {
  return (
    <ComingSoon
      title="Guests"
      description="Everyone you're inviting, grouped into households."
      icon={Users}
      phase={2}
      features={[
        "Households, sides and tags",
        "Dietary and accessibility notes",
        "CSV import with column mapping",
        "Filters, bulk actions and A/B list",
      ]}
    />
  );
}
