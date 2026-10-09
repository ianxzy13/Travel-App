"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { sendMagicLink, signInWithGoogle, verifyEmailCode } from "@/app/login/actions";
import { OtpInput } from "@/components/auth/otp-input";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { v } from "@/lib/i18n/validation";

const schema = z.object({ email: z.email(v("email")) });

export function LoginForm({ next, error }: { next: string; error?: string }) {
  const t = useTranslations("login");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { email: "" } });

  const onSubmit = form.handleSubmit(({ email }) =>
    startTransition(async () => {
      const result = await sendMagicLink({ email, next });
      if (result.ok) setSentTo(email);
      else toast.error(result.error);
    }),
  );

  if (sentTo) {
    return <CheckInbox email={sentTo} next={next} onBack={() => setSentTo(null)} />;
  }

  const emailError = form.formState.errors.email?.message;

  return (
    <div className="space-y-5">
      {error && (
        <p role="alert" className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {error}
        </p>
      )}

      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <Button type="submit" variant="outline" className="w-full">
          <GoogleIcon />
          {t("google")}
        </Button>
      </form>

      <div className="text-muted-foreground flex items-center gap-3 text-xs">
        <Separator className="flex-1" /> {t("or")} <Separator className="flex-1" />
      </div>

      <form onSubmit={onSubmit} className="space-y-3" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">{t("email")}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder={t("emailPlaceholder")}
            aria-invalid={!!emailError}
            aria-describedby={emailError ? "email-error" : undefined}
            {...form.register("email")}
          />
          <FieldError id="email-error" message={emailError} />
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {t("send")}
        </Button>
      </form>
    </div>
  );
}

function CheckInbox({ email, next, onBack }: { email: string; next: string; onBack: () => void }) {
  const t = useTranslations("login");
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [cooldown, setCooldown] = useState(60);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const submit = useCallback(
    (value: string) => {
      if (value.length < 6 || pending) return;
      setError(null);
      startTransition(async () => {
        const result = await verifyEmailCode({ email, code: value });
        if (result.ok) {
          router.replace(next);
          router.refresh();
        } else {
          setError(result.error);
        }
      });
    },
    [email, next, pending, router],
  );

  function handleChange(value: string) {
    setCode(value);
    setError(null);
    if (value.length === 6) submit(value);
  }

  function handleResend() {
    setCooldown(60);
    startTransition(async () => {
      const result = await sendMagicLink({ email, next });
      if (result.ok) toast.success(t("resent"));
      else toast.error(result.error);
    });
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2 text-center" role="status">
        <MailCheck className="text-primary-ink mx-auto size-10" aria-hidden />
        <p className="font-medium">{t("checkInbox")}</p>
        <p className="text-muted-foreground text-sm">
          {t.rich("sentTo", {
            email,
            b: (c) => <strong className="text-foreground">{c}</strong>,
          })}
        </p>
      </div>

      <div className="space-y-2">
        <Label className="block text-center text-sm">{t("code")}</Label>
        <OtpInput value={code} onChange={handleChange} disabled={pending} error={!!error} />
        <FieldError id="code-error" message={error ?? undefined} />
      </div>

      <Button
        onClick={() => submit(code)}
        className="w-full"
        disabled={pending || code.length < 6}
      >
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {t("signInWithCode")}
      </Button>

      <div className="flex flex-col items-center gap-1">
        <Button
          variant="link"
          className="text-muted-foreground text-xs"
          onClick={handleResend}
          disabled={cooldown > 0 || pending}
        >
          {cooldown > 0 ? t("resendWait", { seconds: cooldown }) : t("resend")}
        </Button>
        <Button variant="link" className="text-xs" onClick={onBack}>
          {t("again")}
        </Button>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4">
      <path
        fill="#4285F4"
        d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z"
      />
      <path
        fill="#34A853"
        d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.8 14c-.2-.7-.4-1.4-.4-2.1s.1-1.4.4-2.1V7H2.1a11 11 0 0 0 0 9.9L5.8 14z"
      />
      <path
        fill="#EA4335"
        d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7l3.7 2.9C6.7 7.3 9.1 5.4 12 5.4z"
      />
    </svg>
  );
}
