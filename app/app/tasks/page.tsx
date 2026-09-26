import type { Metadata } from "next";
import { ListChecks } from "lucide-react";
import { ComingSoon } from "@/components/app/coming-soon";

export const metadata: Metadata = { title: "To-dos" };

export default function TodosPage() {
  return (
    <ComingSoon
      title="To-dos"
      description="A timeline from twelve months out to the big day."
      icon={ListChecks}
      phase={9}
      features={[
        "Suggested wedding timeline",
        "Due dates and assignees",
        "Progress on the dashboard",
        "Reminders for overdue tasks",
      ]}
    />
  );
}
