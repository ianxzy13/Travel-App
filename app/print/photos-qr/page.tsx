import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PrintControls } from "@/components/seating/print-controls";
import { PhotoQrPoster } from "@/components/photos/photo-qr-poster";
import { Button } from "@/components/ui/button";
import { getSiteUrl } from "@/lib/site-url";
import { requireWedding } from "@/lib/wedding";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: (await getTranslations("app.photos"))("printQr"),
    robots: { index: false },
  };
}

export default async function PrintPhotosQr() {
  const { wedding } = await requireWedding();
  const t = await getTranslations("app.photos");
  const url = `${await getSiteUrl()}/w/${wedding.slug}/photos`;

  return (
    <div className="bg-background min-h-dvh">
      <div className="mx-auto max-w-lg p-6 print:p-0">
        <div className="mb-6 flex items-center gap-4 print:hidden">
          <Button asChild variant="ghost" size="sm">
            <Link href="/app/photos">
              <ArrowLeft className="size-4" aria-hidden /> {t("title")}
            </Link>
          </Button>
          <div className="ms-auto">
            <PrintControls />
          </div>
        </div>
        <PhotoQrPoster
          url={url}
          couple={`${wedding.partner_a_name} & ${wedding.partner_b_name}`}
        />
      </div>
    </div>
  );
}
