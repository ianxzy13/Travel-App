"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { switchWedding } from "@/app/app/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fmtDate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import type { WeddingSummary } from "@/lib/wedding";

/** Shows the current wedding; lets planners jump between weddings. */
export function WeddingSwitcher({
  current,
  weddings,
  compact = false,
}: {
  current: WeddingSummary;
  weddings: WeddingSummary[];
  compact?: boolean;
}) {
  const t = useTranslations("app.switcher");
  const locale = useLocale();
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "hover:bg-accent focus-visible:ring-ring flex w-full min-w-0 items-center gap-2 rounded-lg text-left transition-colors focus-visible:ring-[3px] focus-visible:outline-none",
          compact ? "justify-center p-2" : "px-3 py-2",
        )}
        aria-label={t("current", { name: current.name })}
      >
        <span
          aria-hidden
          className="bg-primary-soft text-primary flex size-8 shrink-0 items-center justify-center rounded-full font-serif text-base font-semibold"
        >
          {current.name.charAt(0)}
        </span>
        {!compact && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-serif text-lg leading-tight font-semibold">
                {current.name}
              </span>
              <span className="text-muted-foreground block truncate text-xs">
                {current.date ? fmtDate(current.date, locale, "long") : t("noDate")}
              </span>
            </span>
            {pending ? (
              <Loader2 className="text-muted-foreground size-4 animate-spin" aria-hidden />
            ) : (
              <ChevronsUpDown className="text-muted-foreground size-4" aria-hidden />
            )}
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>{t("yours")}</DropdownMenuLabel>
        {weddings.map((w) => (
          <DropdownMenuItem
            key={w.id}
            onSelect={() => {
              if (w.id !== current.id) startTransition(() => switchWedding(w.id));
            }}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate">{w.name}</span>
              <span className="text-muted-foreground block text-xs">
                {w.date ? fmtDate(w.date, locale, "medium") : t("noDate")} · {t(`roles.${w.role}`)}
              </span>
            </span>
            {w.id === current.id && <Check aria-hidden />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/onboarding">
            <Plus aria-hidden /> {t("another")}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
