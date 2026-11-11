"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PRICE_IDS } from "@/lib/billing/config";
import { FREE_LIMITS, PRICES, type Offer, type PlanName } from "@/lib/billing/plans";
import { fmtMoney } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import { loadPaddle, paddleLocale } from "./paddle";

type Props = {
  plan: PlanName;
  /** Owners and editors may buy Vow Plus for this wedding. */
  canBuyPlus: boolean;
  /** Payment keys are set and payments are switched on. */
  checkoutReady: boolean;
  userId: string;
  email: string;
  weddingId: string;
};

const FEATURES = {
  free: ["guests", "languages", "everything"],
  plus: ["unlimitedGuests", "sms", "exports", "shuttles", "seatingScenarios", "noBranding"],
  pro: ["allWeddings", "manyWeddings", "couplesFree"],
} as const;

/** The three plans side by side, with buttons that open the Paddle checkout. */
export function BillingPlans({ plan, canBuyPlus, checkoutReady, userId, email, weddingId }: Props) {
  const t = useTranslations("billing");
  const locale = useLocale();
  const router = useRouter();
  const [busy, setBusy] = useState<Offer | null>(null);
  const price = (o: Offer) => fmtMoney(PRICES[o], "EUR", locale, !Number.isInteger(PRICES[o]));

  async function buy(offer: Offer) {
    setBusy(offer);
    try {
      const paddle = await loadPaddle((e) => {
        if (e.name === "checkout.completed") {
          // The webhook saves the purchase a few seconds later.
          setTimeout(() => router.push("/app/billing?paid=1"), 1500);
        }
      });
      paddle.Checkout.open({
        items: [{ priceId: PRICE_IDS[offer], quantity: 1 }],
        customer: { email },
        customData: { user_id: userId, wedding_id: weddingId },
        settings: {
          displayMode: "overlay",
          locale: paddleLocale(locale),
          successUrl: `${window.location.origin}/app/billing?paid=1`,
        },
      });
    } catch (e) {
      console.error(e);
      toast.error(t("checkoutFailed"));
    } finally {
      setBusy(null);
    }
  }

  const buyButton = (
    offer: Offer,
    label: string,
    variant: "default" | "outline",
    allowed = true,
  ) => (
    <Button
      variant={variant}
      className="w-full"
      disabled={!checkoutReady || !allowed || busy !== null}
      onClick={() => buy(offer)}
    >
      {busy === offer && <Loader2 className="animate-spin" aria-hidden />}
      {label}
    </Button>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <PlanCard
        name={t("plans.free.name")}
        price={fmtMoney(0, "EUR", locale)}
        note={t("plans.free.note")}
        features={FEATURES.free.map((k) =>
          t(`plans.free.features.${k}`, { guests: FREE_LIMITS.guests }),
        )}
        current={plan === "free"}
        currentLabel={t("current")}
      />
      <PlanCard
        name="Vow Plus"
        price={price("plusMonthly")}
        priceNote={t("perMonth")}
        note={t("plans.plus.note", { once: price("plusOnce") })}
        features={FEATURES.plus.map((k) => t(`plans.plus.features.${k}`))}
        current={plan === "plus"}
        currentLabel={t("current")}
        highlight
      >
        {plan === "free" && (
          <div className="flex w-full flex-col gap-2">
            {buyButton("plusMonthly", t("buyMonthly"), "default", canBuyPlus)}
            {buyButton(
              "plusOnce",
              t("buyOnce", { price: price("plusOnce") }),
              "outline",
              canBuyPlus,
            )}
            {!canBuyPlus && <p className="text-muted-foreground text-xs">{t("ownerBuys")}</p>}
          </div>
        )}
      </PlanCard>
      <PlanCard
        name="Vow Pro"
        price={price("proMonthly")}
        priceNote={t("perMonth")}
        note={t("plans.pro.note")}
        features={FEATURES.pro.map((k) => t(`plans.pro.features.${k}`))}
        current={plan === "pro"}
        currentLabel={t("current")}
      >
        {plan !== "pro" && buyButton("proMonthly", t("buyPro"), "outline")}
      </PlanCard>
    </div>
  );
}

function PlanCard({
  name,
  price,
  priceNote,
  note,
  features,
  current,
  currentLabel,
  highlight = false,
  children,
}: {
  name: string;
  price: string;
  priceNote?: string;
  note: string;
  features: string[];
  current: boolean;
  currentLabel: string;
  highlight?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Card className={cn(highlight && "border-primary-ink/40 shadow-sm")}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <p className="caps text-primary-ink">{name}</p>
          {current && <Badge className="bg-tint-sage text-tint-sage-fg">{currentLabel}</Badge>}
        </div>
        <CardTitle className="mt-2 flex items-baseline gap-2 font-serif text-4xl font-light">
          {price}
          {priceNote && (
            <span className="text-muted-foreground font-sans text-sm font-normal">{priceNote}</span>
          )}
        </CardTitle>
        <CardDescription>{note}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <ul className="space-y-3 text-sm">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <span className="bg-primary-soft text-primary-ink mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full">
                <Check className="size-3" aria-hidden />
              </span>
              {f}
            </li>
          ))}
        </ul>
      </CardContent>
      {children && <CardFooter>{children}</CardFooter>}
    </Card>
  );
}
