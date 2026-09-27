import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { SetupNotice } from "@/components/auth/setup-notice";
import { Logo } from "@/components/logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { safeNextPath } from "@/lib/site-url";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getUser } from "@/lib/wedding";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  link: "That sign-in link has expired or was already used. Please request a new one.",
  google: "Google sign-in isn't available right now. Please use your email instead.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next);

  if (isSupabaseConfigured && (await getUser())) redirect(next);

  return (
    <main className="bg-muted/40 flex min-h-dvh flex-col items-center justify-center gap-8 p-4">
      <Logo />
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>
            <h1 className="font-serif text-3xl">Welcome</h1>
          </CardTitle>
          <CardDescription>Sign in or create your account. No password needed.</CardDescription>
        </CardHeader>
        <CardContent>
          {isSupabaseConfigured ? (
            <LoginForm next={next} error={params.error ? ERRORS[params.error] : undefined} />
          ) : (
            <SetupNotice />
          )}
        </CardContent>
      </Card>
    </main>
  );
}
