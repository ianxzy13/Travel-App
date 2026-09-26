import type { Metadata } from "next";
import { MailCheck } from "lucide-react";
import { ComingSoon } from "@/components/app/coming-soon";

export const metadata: Metadata = { title: "RSVPs" };

export default function RSVPsPage() {
  return (
    <ComingSoon
      title="RSVPs"
      description="Invitations, replies and meal counts."
      icon={MailCheck}
      phase={3}
      features={[
        "A private RSVP link per household",
        "Per-event answers and meal choices",
        "Email invites and reminders",
        "Live totals for the caterer",
      ]}
    />
  );
}
