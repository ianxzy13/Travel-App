"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** Friendly fallback if a page crashes. The real error is logged to the console. */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("ui.pageError");
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <h1 className="text-3xl">{t("title")}</h1>
      <p className="text-muted-foreground max-w-sm">{t("text")}</p>
      <Button onClick={reset}>{t("retry")}</Button>
    </div>
  );
}
