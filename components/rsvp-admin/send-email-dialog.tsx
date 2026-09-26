"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, Loader2, Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { previewRsvpEmail, sendRsvpEmails } from "@/app/app/rsvp/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";

export type EmailTarget = { id: string; name: string; hasEmail: boolean };

/** Choose invitation/reminder, add a note, preview, send. */
export function SendEmailDialog({
  open,
  onOpenChange,
  households,
  emailConfigured,
  defaultKind = "invitation",
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  households: EmailTarget[];
  emailConfigured: boolean;
  defaultKind?: "invitation" | "reminder";
  onSent?: () => void;
}) {
  const [kind, setKind] = useState(defaultKind);
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<{ html: string; subject: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const withEmail = households.filter((h) => h.hasEmail);
  const without = households.filter((h) => !h.hasEmail);

  useEffect(() => {
    if (open) setKind(defaultKind);
  }, [open, defaultKind]);

  // Refresh the preview shortly after the note or type changes.
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(async () => {
      const result = await previewRsvpEmail(kind, note);
      if (result.ok) setPreview(result.data);
    }, 400);
    return () => clearTimeout(timer);
  }, [open, kind, note]);

  function send() {
    startTransition(async () => {
      const result = await sendRsvpEmails({ householdIds: withEmail.map((h) => h.id), kind, note });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const { sent, failed } = result.data;
      toast.success(
        `Sent to ${sent} household${sent === 1 ? "" : "s"}${failed ? ` (${failed} failed)` : ""}`,
      );
      onOpenChange(false);
      setNote("");
      onSent?.();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Email your guests</DialogTitle>
          <DialogDescription>
            Each household gets one email with its private RSVP link, sent to everyone in it who has
            an email address.
          </DialogDescription>
        </DialogHeader>

        {!emailConfigured ? (
          <div className="bg-warning/10 flex gap-3 rounded-lg p-4 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              Email isn&apos;t set up yet. Add a free Resend API key as <code>RESEND_API_KEY</code>{" "}
              in <code>.env.local</code> (see the README), then restart the app. Meanwhile you can
              copy each household&apos;s link or share it on WhatsApp from the RSVP page.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-[1fr_1.2fr]">
            <div className="space-y-5">
              <p className="text-sm">
                <strong>{withEmail.length}</strong> household{withEmail.length === 1 ? "" : "s"}{" "}
                will get an email.
              </p>
              {without.length > 0 && (
                <p className="bg-muted text-muted-foreground rounded-md p-3 text-sm">
                  {without.length} without an email address will be skipped:{" "}
                  {without
                    .slice(0, 6)
                    .map((h) => h.name)
                    .join(", ")}
                  {without.length > 6 && "…"}. Share their link on WhatsApp instead.
                </p>
              )}

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Type of email</legend>
                <RadioGroup value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="invitation" /> Invitation
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="reminder" /> Friendly reminder
                  </label>
                </RadioGroup>
              </fieldset>

              <div className="space-y-2">
                <Label htmlFor="email-note">Personal note (optional)</Label>
                <Textarea
                  id="email-note"
                  rows={4}
                  maxLength={1000}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. We can't wait to celebrate with you in Sintra!"
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                <Mail className="size-4" aria-hidden /> Preview
                {preview && <span className="text-foreground truncate">· {preview.subject}</span>}
              </p>
              <div className="bg-muted h-96 overflow-hidden rounded-lg border">
                {preview ? (
                  // sandbox: the preview can't run scripts or navigate the app
                  <iframe
                    title="Email preview"
                    srcDoc={preview.html}
                    sandbox=""
                    className="size-full"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Loader2
                      className="text-muted-foreground animate-spin"
                      aria-label="Loading preview"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          {emailConfigured && (
            <Button onClick={send} disabled={pending || withEmail.length === 0}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
              Send {withEmail.length} email{withEmail.length === 1 ? "" : "s"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
