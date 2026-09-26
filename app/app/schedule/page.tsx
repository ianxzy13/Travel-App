import type { Metadata } from "next";
import { Clock } from "lucide-react";
import { ComingSoon } from "@/components/app/coming-soon";

export const metadata: Metadata = { title: "Day-of schedule" };

export default function DayofschedulePage() {
  return (
    <ComingSoon
      title="Day-of schedule"
      description="Minute-by-minute run sheet for the day."
      icon={Clock}
      phase={9}
      features={[
        "Timeline for the wedding day",
        "Who is where, when",
        "Printable for vendors",
        "Shared with collaborators",
      ]}
    />
  );
}
