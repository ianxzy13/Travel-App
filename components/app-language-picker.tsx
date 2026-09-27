"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { setAppLanguage } from "@/app/app/settings/language-actions";
import { LanguageSelect } from "@/components/language-select";
import { cn } from "@/lib/utils";

/** The app's language (with flags), for pages before signing in. */
export function AppLanguagePicker({ className }: { className?: string }) {
  const t = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <LanguageSelect
      variant="link"
      value={locale}
      label={t("language")}
      onChange={(code) =>
        code &&
        code !== locale &&
        startTransition(async () => {
          await setAppLanguage(code);
          router.refresh();
        })
      }
      className={cn("px-2", pending && "opacity-60", className)}
    />
  );
}
