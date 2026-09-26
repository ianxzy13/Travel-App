import type { Metadata } from "next";
import { Globe } from "lucide-react";
import { ComingSoon } from "@/components/app/coming-soon";

export const metadata: Metadata = { title: "Wedding website" };

export default function WeddingwebsitePage() {
  return (
    <ComingSoon
      title="Wedding website"
      description="A beautiful site for your guests."
      icon={Globe}
      phase={8}
      features={[
        "Five distinct templates",
        "Drag-and-drop sections",
        "Built-in RSVP",
        "Password protection and sharing",
      ]}
    />
  );
}
