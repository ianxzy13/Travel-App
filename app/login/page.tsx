import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppLanguagePicker } from "@/components/app-language-picker";
import { LoginForm } from "@/components/auth/login-form";
import { SetupNotice } from "@/components/auth/setup-notice";
import { Logo } from "@/components/logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { safeNextPath } from "@/lib/site-url";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getUser } from "@/lib/wedding";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("login"))("title") };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const t = await getTranslations("login");

  if (isSupabaseConfigured && (await getUser())) redirect(next);

  const error =
    params.error === "link" ? t("errorLink") : params.error === "google" ? t("errorGoogle") : undefined;

  return (
    <main className="bg-muted/40 relative flex min-h-dvh flex-col items-center justify-center gap-8 p-4">
      <AppLanguagePicker className="absolute end-4 top-4" />
      <Logo />
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>
            <h1 className="font-serif text-3xl">{t("welcome")}</h1>
          </CardTitle>
          <CardDescription>{t("intro")}</CardDescription>
        </CardHeader>
        <CardContent>
          {isSupabaseConfigured ? <LoginForm next={next} error={error} /> : <SetupNotice />}
        </CardContent>
      </Card>
    </main>
  );
}
