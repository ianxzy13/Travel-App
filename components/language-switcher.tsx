"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { LOCALES, localeInfo } from "@/i18n/locales";
import { cn } from "@/lib/utils";

/**
 * Language picker for guest pages. The couple's languages come first; every
 * other language Vow speaks is under "More languages" (buttons and dates are
 * translated there; the couple's own texts stay in their main language).
 * Choosing one reloads the page with ?lang=…, which is also remembered.
 */
export function LanguageSwitcher({
  offered,
  onChange,
  className,
}: {
  /** the wedding's languages, main language first */
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
  const first = offered.filter((c) => LOCALES.some((l) => l.code === c));
  const rest = LOCALES.filter((l) => !first.includes(l.code));

  function pick(code: string) {
    onChange?.(code);
    const next = new URLSearchParams(params.toString());
    next.set("lang", code);
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
      router.refresh();
    });
  }

  return (
    <label
      className={cn(
        "relative inline-flex items-center gap-1.5 text-sm",
        pending && "opacity-60",
        className,
      )}
    >
      <Globe className="size-4 shrink-0 opacity-70" aria-hidden />
      <span className="sr-only">{t("language")}</span>
      <select
        value={locale}
        onChange={(e) => pick(e.target.value)}
        className="cursor-pointer appearance-none bg-transparent py-1 pe-1 font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
      >
        {first.map((code) => (
          <option key={code} value={code}>
            {localeInfo(code).native}
          </option>
        ))}
        <optgroup label={t("moreLanguages")}>
          {rest.map((l) => (
            <option key={l.code} value={l.code}>
              {l.native}
            </option>
          ))}
        </optgroup>
      </select>
    </label>
  );
}
