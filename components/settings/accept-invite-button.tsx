"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { acceptInvitation } from "@/app/invite/[token]/actions";
import { Button } from "@/components/ui/button";

export function AcceptInviteButton({ token }: { token: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="lg"
      className="w-full"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await acceptInvitation(token);
          // Success redirects to the dashboard.
          if (result && !result.ok) toast.error(result.error);
        })
      }
    >
      {pending && <Loader2 className="animate-spin" aria-hidden />}
      Accept and start planning
    </Button>
  );
}
