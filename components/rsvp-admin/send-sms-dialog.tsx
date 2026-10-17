"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Loader2, MessageSquare, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { sendRsvpSms } from "@/app/app/rsvp/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export type SmsTarget = { id: string; name: string; hasPhone: boolean };

export function SendSmsDialog({
  open,
  onOpenChange,
  households,
  smsConfigured,
  couple,
  siteUrl,
  defaultKind = "invitation",
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  households: SmsTarget[];
  smsConfigured: boolean;
  couple: string;
  siteUrl: string;
  defaultKind?: "invitation" | "reminder";
  onSent?: () => void;
}) {
  const t = useTranslations("rsvpAdmin.sms");
  const [kind, setKind] = useState(defaultKind);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  const withPhone = households.filter((h) => h.hasPhone);
  const without = households.filter((h) => !h.hasPhone);

  const previewText =
    kind === "invitation"
      ? `${couple}: You're invited! RSVP here: ${siteUrl}/r/XXXXXX`
      : `${couple}: Friendly reminder to RSVP: ${siteUrl}/r/XXXXXX`;

  function send() {
    startTransition(async () => {
      const result = await sendRsvpSms({
        householdIds: withPhone.map((h) => h.id),
        kind,
        note,
      });
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
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {!smsConfigured ? (
          <div className="bg-warning/10 flex gap-3 rounded-lg p-4 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>{t.rich("notSetUp", { code: (c) => <code>{c}</code> })}</p>
          </div>
        ) : (
          <div className="space-y-5">
            <p className="text-sm">
              {t.rich("willGet", { count: withPhone.length, b: (c) => <strong>{c}</strong> })}
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
              <Label htmlFor="sms-note">{t("note")}</Label>
              <Textarea
                id="sms-note"
                rows={2}
                maxLength={300}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("notePlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                <MessageSquare className="size-4" aria-hidden /> {t("preview")}
              </p>
              <div className="bg-muted rounded-lg p-4 text-sm whitespace-pre-line">
                {previewText}
                {note && `\n${note}`}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {t("cancel")}
          </Button>
          {smsConfigured && (
            <Button onClick={send} disabled={pending || withPhone.length === 0}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
              {t("send", { count: withPhone.length })}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
