"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { openBillingPortal } from "@/app/app/billing/actions";
import { Button } from "@/components/ui/button";

/** Opens Paddle's page to change the card, see invoices or cancel. */
export function ManageButton() {
  const t = useTranslations("billing");
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await openBillingPortal();
          if (r && !r.ok) toast.error(r.error);
        })
      }
    >
      {pending && <Loader2 className="animate-spin" aria-hidden />}
      {t("manage")}
    </Button>
  );
}
