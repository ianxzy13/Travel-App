"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, Loader2, Mail, Send } from "lucide-react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("rsvpAdmin.email");
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
      toast.success(failed ? t("sentFailed", { sent, failed }) : t("sent", { sent }));
      onOpenChange(false);
      setNote("");
      onSent?.();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {!emailConfigured ? (
          <div className="bg-warning/10 flex gap-3 rounded-lg p-4 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>{t.rich("notSetUp", { code: (c) => <code>{c}</code> })}</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-[1fr_1.2fr]">
            <div className="space-y-5">
              <p className="text-sm">
                {t.rich("willGet", { count: withEmail.length, b: (c) => <strong>{c}</strong> })}
              </p>
              {without.length > 0 && (
                <p className="bg-muted text-muted-foreground rounded-md p-3 text-sm">
                  {t("skipped", {
                    count: without.length,
                    names:
                      without
                        .slice(0, 6)
                        .map((h) => h.name)
                        .join(", ") + (without.length > 6 ? "…" : ""),
                  })}
                </p>
              )}

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">{t("type")}</legend>
                <RadioGroup value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="invitation" /> {t("invitation")}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="reminder" /> {t("reminder")}
                  </label>
                </RadioGroup>
              </fieldset>

              <div className="space-y-2">
                <Label htmlFor="email-note">{t("note")}</Label>
                <Textarea
                  id="email-note"
                  rows={4}
                  maxLength={1000}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t("notePlaceholder")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                <Mail className="size-4" aria-hidden /> {t("preview")}
                {preview && <span className="text-foreground truncate">· {preview.subject}</span>}
              </p>
              <div className="bg-muted h-96 overflow-hidden rounded-lg border">
                {preview ? (
                  // sandbox: the preview can't run scripts or navigate the app
                  <iframe
                    title={t("previewTitle")}
                    srcDoc={preview.html}
                    sandbox=""
                    className="size-full"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Loader2
                      className="text-muted-foreground animate-spin"
                      aria-label={t("loading")}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {t("cancel")}
          </Button>
          {emailConfigured && (
            <Button onClick={send} disabled={pending || withEmail.length === 0}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
              {t("send", { count: withEmail.length })}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
