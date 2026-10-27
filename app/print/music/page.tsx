import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { PrintControls } from "@/components/seating/print-controls";
import { Button } from "@/components/ui/button";
import { fmtDate } from "@/lib/i18n/format";
import { loadMusic } from "@/lib/music/load";
import { djMoments, songLabel } from "@/lib/music/songs";
import { toDjMoments } from "@/lib/music/types";
import { createClient } from "@/lib/supabase/server";
import { coupleName, requireWedding } from "@/lib/wedding";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("music"))("dj.printTitle"), robots: { index: false } };
}

/** The song list for the DJ or band, moment by moment, "Do not play" at the end. */
export default async function PrintMusic({
  searchParams,
}: {
  searchParams: Promise<{ nice?: string; vendor?: string }>;
}) {
  const { wedding } = await requireWedding();
  const t = await getTranslations("music");
  const locale = await getLocale();
  const q = await searchParams;
  const sb = await createClient();
  const data = await loadMusic(sb, wedding, locale, false);
  const vendor = data.vendors.find((v) => v.id === q.vendor);
  const moments = djMoments(toDjMoments(data), q.nice !== "0");

  return (
    <main className="mx-auto max-w-3xl bg-white p-6 text-[#4a3f3a] print:max-w-none print:p-0">
      <style>{`@page { margin: 14mm; } @media print { body { background: white; } }`}</style>
      <div className="mb-6 flex flex-wrap items-center gap-2 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link href="/app/music">
            <ArrowLeft className="rtl:rotate-180" aria-hidden /> {t("dj.back")}
          </Link>
        </Button>
        <div className="ms-auto">
          <PrintControls />
        </div>
      </div>

      <header className="mb-6 border-b border-[#e5d9d0] pb-4">
        <p className="text-xs tracking-[0.25em] text-[#7a6960] uppercase">{t("dj.printTitle")}</p>
        <h1 className="font-serif text-4xl font-medium">{coupleName(wedding)}</h1>
        <p className="text-[#6b5c54]">
          {[
            wedding.wedding_date ? fmtDate(wedding.wedding_date, locale, "full") : null,
            vendor && t("dj.for", { name: vendor.name }),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </header>

      {moments.length === 0 && <p className="text-[#7a6960]">{t("dj.noSongs")}</p>}

      <div className="space-y-6">
        {moments.map((m) => (
          <section
            key={`${m.name}-${m.time}`}
            className={
              m.doNotPlay
                ? "break-inside-avoid rounded-lg border-2 border-[#b4544a] p-4"
                : "break-inside-avoid"
            }
          >
            <h2 className="mb-2 flex items-baseline gap-3 font-serif text-2xl font-medium">
              {m.name}
              {m.time && (
                <span className="text-base font-normal text-[#7a6960] tabular-nums">{m.time}</span>
              )}
            </h2>
            <ol className="space-y-1.5 text-sm">
              {m.songs.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="w-5 shrink-0 text-end text-[#7a6960] tabular-nums">
                    {i + 1}.
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{songLabel(s)}</span>
                    {!m.doNotPlay && (
                      <span className="ms-2 text-xs text-[#7a6960]">
                        {[t(`priority.${s.priority}`), s.language].filter(Boolean).join(" · ")}
                      </span>
                    )}
                    {s.note && <span className="block text-[#6b5c54] italic">{s.note}</span>}
                    {s.url && (
                      <span className="block text-xs break-all text-[#7a6960]">{s.url}</span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </main>
  );
}
