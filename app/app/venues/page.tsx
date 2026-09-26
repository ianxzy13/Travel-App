import type { Metadata } from "next";
import { Landmark } from "lucide-react";
import { ComingSoon } from "@/components/app/coming-soon";

export const metadata: Metadata = { title: "Venues" };

export default function VenuesPage() {
  return (
    <ComingSoon
      title="Venues"
      description="Compare and book the perfect place."
      icon={Landmark}
      phase={6}
      features={[
        "Capacity, price and availability",
        "Side-by-side comparison",
        "Site-visit checklists",
        "Ratings, pros and cons",
      ]}
    />
  );
}
