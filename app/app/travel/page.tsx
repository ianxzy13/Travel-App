import type { Metadata } from "next";
import { Plane } from "lucide-react";
import { ComingSoon } from "@/components/app/coming-soon";

export const metadata: Metadata = { title: "Travel" };

export default function TravelPage() {
  return (
    <ComingSoon
      title="Travel"
      description="Flights for you, your guests and the honeymoon."
      icon={Plane}
      phase={6}
      features={[
        "Flights linked to guests",
        "Arrivals board for pickups",
        "Quick Google Flights search",
        "Honeymoon planning",
      ]}
    />
  );
}
