import type { Metadata } from "next";
import { Armchair } from "lucide-react";
import { ComingSoon } from "@/components/app/coming-soon";

export const metadata: Metadata = { title: "Seating chart" };

export default function SeatingchartPage() {
  return (
    <ComingSoon
      title="Seating chart"
      description="Drag and drop your guests onto tables."
      icon={Armchair}
      phase={4}
      features={[
        "Round, banquet and head tables",
        "Drag guests or whole households",
        "Keep-together and keep-apart rules",
        "Auto-arrange, undo/redo, print and PDF",
      ]}
    />
  );
}
