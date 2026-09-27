"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { LanguageSelect } from "@/components/language-select";
import { cn } from "@/lib/utils";

/**
 * Language picker (with flags) for guest pages. The wedding's languages come
 * first; every other language Vow speaks follows (buttons and dates are then
 * translated; the couple's own texts stay in their language).
 * Choosing one reloads the page with ?lang=…, which is also remembered.
 */
export function LanguageSwitcher({
  offered,
  onChange,
  className,
}: {
  /** the wedding's languages, the couple's own first */
  offered: readonly string[];
  /** e.g. remember the choice for an RSVP household */
  onChange?: (locale: string) => void;
  className?: string;
}) {
  const t = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function pick(code: string) {
    if (!code || code === locale) return;
    onChange?.(code);
    const next = new URLSearchParams(params.toString());
    next.set("lang", code);
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
      router.refresh();
    });
  }

  return (
    <LanguageSelect
      variant="link"
      value={locale}
      onChange={pick}
      label={t("language")}
      featured={offered}
      moreLabel={t("moreLanguages")}
      className={cn(pending && "opacity-60", className)}
    />
  );
}
