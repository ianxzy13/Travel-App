import type { Metadata } from "next";
import { Store } from "lucide-react";
import { ComingSoon } from "@/components/app/coming-soon";

export const metadata: Metadata = { title: "Vendors" };

export default function VendorsPage() {
  return (
    <ComingSoon
      title="Vendors"
      description="Your photographer, florist, DJ and more."
      icon={Store}
      phase={5}
      features={[
        "Contact book by category",
        "Quotes and contracts",
        "Status tracking",
        "Linked to budget expenses",
      ]}
    />
  );
}
