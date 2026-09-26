import type { Metadata } from "next";
import { BedDouble } from "lucide-react";
import { ComingSoon } from "@/components/app/coming-soon";

export const metadata: Metadata = { title: "Hotels" };

export default function HotelsPage() {
  return (
    <ComingSoon
      title="Hotels"
      description="Places to stay for you and your guests."
      icon={BedDouble}
      phase={6}
      features={[
        "Room blocks and cut-off dates",
        "Discount codes and booking links",
        "Assign guests to hotels",
        "Shown on your wedding website",
      ]}
    />
  );
}
