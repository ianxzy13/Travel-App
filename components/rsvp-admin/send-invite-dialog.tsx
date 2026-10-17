"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, Loader2, Mail, MessageSquare, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { previewRsvpEmail, sendRsvpEmails, sendRsvpSms } from "@/app/app/rsvp/actions";
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

export type InviteTarget = {
  id: string;
  name: string;
  hasEmail: boolean;
  hasPhone: boolean;
};

type Channel = "email" | "sms" | "both";

export function SendInviteDialog({
  open,
  onOpenChange,
  households,
  emailConfigured,
  smsConfigured,
  couple,
  siteUrl,
  defaultKind = "invitation",
  defaultChannel = "email",
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  households: InviteTarget[];
  emailConfigured: boolean;
  smsConfigured: boolean;
  couple: string;
  siteUrl: string;
  defaultKind?: "invitation" | "reminder";
  defaultChannel?: Channel;
  onSent?: () => void;
}) {
  const t = useTranslations("rsvpAdmin.invite");
  const [channel, setChannel] = useState<Channel>(defaultChannel);
  const [kind, setKind] = useState(defaultKind);
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<{ html: string; subject: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const sendEmail = channel === "email" || channel === "both";
  const sendSms = channel === "sms" || channel === "both";

  const withEmail = households.filter((h) => h.hasEmail);
  const withPhone = households.filter((h) => h.hasPhone);
  const noContact = households.filter((h) => !h.hasEmail && !h.hasPhone);

  const emailCount = sendEmail ? withEmail.length : 0;
  const smsCount = sendSms ? withPhone.length : 0;

  useEffect(() => {
    if (open) {
      setKind(defaultKind);
      setChannel(defaultChannel);
    }
  }, [open, defaultKind, defaultChannel]);

  useEffect(() => {
    if (!open || !sendEmail) {
      setPreview(null);
      return;
    }
    const timer = setTimeout(async () => {
      const result = await previewRsvpEmail(kind, note);
      if (result.ok) setPreview(result.data);
    }, 400);
    return () => clearTimeout(timer);
  }, [open, kind, note, sendEmail]);

  const smsPreviewText =
    kind === "invitation"
      ? `${couple}: You're invited! RSVP here: ${siteUrl}/r/XXXXXX`
      : `${couple}: Friendly reminder to RSVP: ${siteUrl}/r/XXXXXX`;

  function send() {
    startTransition(async () => {
      const results: string[] = [];
      let anyError = false;

      if (sendEmail && withEmail.length > 0) {
        const r = await sendRsvpEmails({
          householdIds: withEmail.map((h) => h.id),
          kind,
          note,
        });
        if (!r.ok) {
          toast.error(r.error);
          anyError = true;
        } else {
          const { sent, failed } = r.data;
          results.push(
            failed
              ? t("emailResult", { sent, failed })
              : t("emailSent", { sent }),
          );
        }
      }

      if (sendSms && withPhone.length > 0) {
        const r = await sendRsvpSms({
          householdIds: withPhone.map((h) => h.id),
          kind,
          note,
        });
        if (!r.ok) {
          toast.error(r.error);
          anyError = true;
        } else {
          const { sent, failed } = r.data;
          results.push(
            failed
              ? t("smsResult", { sent, failed })
              : t("smsSent", { sent }),
          );
        }
      }

      if (results.length > 0) {
        toast.success(results.join(" · "));
      }
      if (!anyError) {
        onOpenChange(false);
        setNote("");
        onSent?.();
      }
    });
  }

  const neitherConfigured = !emailConfigured && !smsConfigured;
  const totalRecipients = new Set([
    ...(sendEmail ? withEmail.map((h) => h.id) : []),
    ...(sendSms ? withPhone.map((h) => h.id) : []),
  ]).size;

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {neitherConfigured ? (
          <div className="bg-warning/10 flex gap-3 rounded-lg p-4 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>{t.rich("neitherSetUp", { code: (c) => <code>{c}</code> })}</p>
          </div>
        ) : (
          <div className={sendEmail ? "grid gap-6 md:grid-cols-[1fr_1.2fr]" : "space-y-5"}>
            <div className="space-y-5">
              {/* Channel picker */}
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">{t("channel")}</legend>
                <RadioGroup value={channel} onValueChange={(v) => setChannel(v as Channel)}>
                  <label className={labelCn(emailConfigured)}>
                    <RadioGroupItem value="email" disabled={!emailConfigured} />
                    <Mail className="size-4" aria-hidden />
                    {t("channelEmail")}
                    {!emailConfigured && (
                      <span className="text-muted-foreground text-xs">({t("notConfigured")})</span>
                    )}
                  </label>
                  <label className={labelCn(smsConfigured)}>
                    <RadioGroupItem value="sms" disabled={!smsConfigured} />
                    <MessageSquare className="size-4" aria-hidden />
                    {t("channelSms")}
                    {!smsConfigured && (
                      <span className="text-muted-foreground text-xs">({t("notConfigured")})</span>
                    )}
                  </label>
                  <label className={labelCn(emailConfigured && smsConfigured)}>
                    <RadioGroupItem value="both" disabled={!emailConfigured || !smsConfigured} />
                    <Send className="size-4" aria-hidden />
                    {t("channelBoth")}
                  </label>
                </RadioGroup>
              </fieldset>

              {/* Summary */}
              <div className="text-sm space-y-1">
                {sendEmail && (
                  <p>
                    {t.rich("emailWillGet", { count: withEmail.length, b: (c) => <strong>{c}</strong> })}
                  </p>
                )}
                {sendSms && (
                  <p>
                    {t.rich("smsWillGet", { count: withPhone.length, b: (c) => <strong>{c}</strong> })}
                  </p>
                )}
                {noContact.length > 0 && (
                  <p className="bg-muted text-muted-foreground rounded-md p-3">
                    {t("noContact", {
                      count: noContact.length,
                      names:
                        noContact
                          .slice(0, 6)
                          .map((h) => h.name)
                          .join(", ") + (noContact.length > 6 ? "…" : ""),
                    })}
                  </p>
                )}
              </div>

              {/* Kind */}
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

              {/* Note */}
              <div className="space-y-2">
                <Label htmlFor="invite-note">{t("note")}</Label>
                <Textarea
                  id="invite-note"
                  rows={sendEmail ? 4 : 2}
                  maxLength={sendEmail ? 1000 : 300}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t("notePlaceholder")}
                />
              </div>

              {/* SMS preview (shown when no email preview panel) */}
              {sendSms && !sendEmail && (
                <div className="space-y-2">
                  <p className="text-muted-foreground flex items-center gap-2 text-sm">
                    <MessageSquare className="size-4" aria-hidden /> {t("smsPreview")}
                  </p>
                  <div className="bg-muted rounded-lg p-4 text-sm whitespace-pre-line">
                    {smsPreviewText}
                    {note && `\n${note}`}
                  </div>
                </div>
              )}
            </div>

            {/* Email preview panel */}
            {sendEmail && (
              <div className="space-y-2">
                <p className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Mail className="size-4" aria-hidden /> {t("emailPreview")}
                  {preview && <span className="text-foreground truncate">· {preview.subject}</span>}
                </p>
                <div className="bg-muted h-96 overflow-hidden rounded-lg border">
                  {preview ? (
                    <iframe
                      title={t("emailPreview")}
                      srcDoc={preview.html}
                      sandbox=""
                      className="size-full"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Loader2 className="text-muted-foreground animate-spin" aria-label={t("loading")} />
                    </div>
                  )}
                </div>
                {sendSms && (
                  <div className="space-y-1 pt-2">
                    <p className="text-muted-foreground flex items-center gap-2 text-sm">
                      <MessageSquare className="size-4" aria-hidden /> {t("smsPreview")}
                    </p>
                    <div className="bg-muted rounded-lg p-3 text-sm whitespace-pre-line">
                      {smsPreviewText}
                      {note && `\n${note}`}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {t("cancel")}
          </Button>
          {!neitherConfigured && (
            <Button onClick={send} disabled={pending || totalRecipients === 0}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
              {t("send", { count: totalRecipients })}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function labelCn(enabled: boolean) {
  return `flex items-center gap-2 text-sm ${enabled ? "" : "opacity-50"}`;
}
