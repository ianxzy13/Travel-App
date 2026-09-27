"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** Print button. Also switches the page to light colours while it's open. */
export function PrintControls() {
  const t = useTranslations("seating.printPage");
  useEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    root.classList.remove("dark");
    return () => {
      if (wasDark) root.classList.add("dark");
    };
  }, []);

  return (
    <Button onClick={() => window.print()}>
      <Printer aria-hidden /> {t("button")}
    </Button>
  );
}
