"use client";

import { QRCodeSVG } from "qrcode.react";
import { useTranslations } from "next-intl";

export function QrPoster({ url, couple }: { url: string; couple: string }) {
  const t = useTranslations("seating");

  return (
    <div className="flex flex-col items-center gap-8 rounded-2xl border bg-white p-12 text-center text-black print:border-0 print:shadow-none">
      <h1 className="font-serif text-4xl">{t("findSeatHeading")}</h1>
      <p className="text-muted-foreground text-lg">{couple}</p>
      <QRCodeSVG value={url} size={240} level="M" />
      <p className="text-muted-foreground text-sm">{t("findSeatScan")}</p>
    </div>
  );
}
