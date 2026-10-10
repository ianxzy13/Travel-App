import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PrintControls } from "@/components/seating/print-controls";
import { QrPoster } from "@/components/seating/qr-poster";
import { Button } from "@/components/ui/button";
import { getSiteUrl } from "@/lib/site-url";
import { requireWedding } from "@/lib/wedding";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: (await getTranslations("seating"))("findSeatQr"),
    robots: { index: false },
  };
}

export default async function PrintFindSeatQr() {
  const { wedding } = await requireWedding();
  const t = await getTranslations("seating");
  const url = `${await getSiteUrl()}/w/${wedding.slug}/seat`;

  return (
    <div className="bg-background min-h-dvh">
      <div className="mx-auto max-w-lg p-6 print:p-0">
        <div className="mb-6 flex items-center gap-4 print:hidden">
          <Button asChild variant="ghost" size="sm">
            <Link href="/app/seating">
              <ArrowLeft className="size-4" aria-hidden /> {t("heading")}
            </Link>
          </Button>
          <div className="ms-auto">
            <PrintControls />
          </div>
        </div>
        <QrPoster
          url={url}
          couple={`${wedding.partner_a_name} & ${wedding.partner_b_name}`}
        />
      </div>
    </div>
  );
}
