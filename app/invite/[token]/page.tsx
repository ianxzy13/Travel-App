import type { Metadata } from "next";
import Link from "next/link";
import { HeartHandshake } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AcceptInviteButton } from "@/components/settings/accept-invite-button";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/wedding";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("invite"))("metaTitle") };
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await requireUser(); // middleware already sends signed-out users to /login
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_invitation", { invite_token: token });
  const invite = data?.[0];
  const t = await getTranslations("invite");
  const roles = await getTranslations("roles");

  return (
    <main className="bg-muted/40 flex min-h-dvh flex-col items-center justify-center gap-8 p-4">
      <Logo />
      <Card className="w-full max-w-md">
        <CardContent className="space-y-4 p-8 text-center">
          <HeartHandshake className="text-primary mx-auto size-10" aria-hidden />
          {!invite || invite.status !== "pending" ? (
            <>
              <h1 className="text-3xl">
                {invite?.status === "accepted" ? t("used") : t("invalid")}
              </h1>
              <p className="text-muted-foreground">
                {invite?.status === "expired" ? t("expired") : t("askNew")}
              </p>
              <Button asChild variant="outline">
                <Link href="/app">{t("dashboard")}</Link>
              </Button>
            </>
          ) : (
            <>
              <h1 className="text-3xl">
                {t("title", { couple: `${invite.partner_a_name} & ${invite.partner_b_name}` })}
              </h1>
              <p className="text-muted-foreground">
                {t.rich("as", {
                  role: roles(`${invite.role}.label`),
                  description: roles(`${invite.role}.description`),
                  b: (c) => <strong className="text-foreground">{c}</strong>,
                })}
              </p>
              <p className="text-muted-foreground text-sm">{t("signedInAs", { email: user.email ?? "" })}</p>
              <AcceptInviteButton token={token} />
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
