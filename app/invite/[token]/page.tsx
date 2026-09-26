import type { Metadata } from "next";
import Link from "next/link";
import { HeartHandshake } from "lucide-react";
import { AcceptInviteButton } from "@/components/settings/accept-invite-button";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABELS } from "@/lib/validation/wedding";
import { requireUser } from "@/lib/wedding";

export const metadata: Metadata = { title: "You're invited" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await requireUser(); // middleware already sends signed-out users to /login
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_invitation", { invite_token: token });
  const invite = data?.[0];

  return (
    <main className="bg-muted/40 flex min-h-dvh flex-col items-center justify-center gap-8 p-4">
      <Logo />
      <Card className="w-full max-w-md">
        <CardContent className="space-y-4 p-8 text-center">
          <HeartHandshake className="text-primary mx-auto size-10" aria-hidden />
          {!invite || invite.status !== "pending" ? (
            <>
              <h1 className="text-3xl">
                {invite?.status === "accepted"
                  ? "This invitation was already used"
                  : "This invitation isn't valid"}
              </h1>
              <p className="text-muted-foreground">
                {invite?.status === "expired"
                  ? "It has expired. Ask the couple to send you a new link."
                  : "Ask the couple to send you a new link if you still need access."}
              </p>
              <Button asChild variant="outline">
                <Link href="/app">Go to my dashboard</Link>
              </Button>
            </>
          ) : (
            <>
              <h1 className="text-3xl">
                Help plan {invite.partner_a_name} &amp; {invite.partner_b_name}&apos;s wedding
              </h1>
              <p className="text-muted-foreground">
                You&apos;ve been invited as{" "}
                <strong className="text-foreground">
                  {ROLE_LABELS[invite.role].label.toLowerCase()}
                </strong>
                : {ROLE_LABELS[invite.role].description.toLowerCase()}.
              </p>
              <p className="text-muted-foreground text-sm">Signed in as {user.email}</p>
              <AcceptInviteButton token={token} />
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
