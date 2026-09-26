import type { Metadata } from "next";
import { CodeForm } from "@/components/rsvp/code-form";
import { RsvpFrame } from "@/components/rsvp/rsvp-frame";

export const metadata: Metadata = { title: "RSVP", robots: { index: false } };

/** /r — type the code from your invitation. */
export default function RsvpCodePage() {
  return (
    <RsvpFrame>
      <div className="bg-card mx-auto mt-10 max-w-md rounded-2xl border p-8 shadow-sm">
        <h1 className="text-center text-4xl">RSVP</h1>
        <p className="text-muted-foreground mt-2 mb-6 text-center">
          Enter the code from your invitation email or card.
        </p>
        <CodeForm />
      </div>
    </RsvpFrame>
  );
}
