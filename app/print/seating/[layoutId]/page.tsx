import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PrintControls } from "@/components/seating/print-controls";
import { PrintSeatingView, VIEWS, type ViewKey } from "@/components/seating/print-view";
import { Button } from "@/components/ui/button";
import { loadSeatingData } from "@/lib/seating/load";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { coupleName, requireUser } from "@/lib/wedding";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("seating.printPage"))("title"), robots: { index: false } };
}

/** Printable versions of a seating chart. Use the browser's print dialog to save as PDF. */
export default async function PrintSeatingPage({
  params,
  searchParams,
}: {
  params: Promise<{ layoutId: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  await requireUser();
  const { layoutId } = await params;
  const requested = (await searchParams).view;
  const view: ViewKey = VIEWS.includes(requested as ViewKey) ? (requested as ViewKey) : "plan";
  const t = await getTranslations("seating");

  const supabase = await createClient();
  // RLS: only members of this wedding can see the layout
  const { data: layout } = await supabase
    .from("seating_layouts")
    .select("*")
    .eq("id", layoutId)
    .maybeSingle();
  if (!layout) notFound();
  const [{ data: wedding }, { data: event }, data] = await Promise.all([
    supabase
      .from("weddings")
      .select("partner_a_name, partner_b_name")
      .eq("id", layout.wedding_id)
      .single(),
    supabase.from("events").select("name").eq("id", layout.event_id).single(),
    loadSeatingData(supabase, layout),
  ]);

  const { state } = data;
  const title = `${wedding ? coupleName(wedding) : ""} · ${event?.name ?? ""}`;

  return (
    <main className="mx-auto max-w-5xl bg-white p-6 text-[#4a3f3a] print:max-w-none print:p-0">
      {/* page setup: landscape for the floor plan */}
      <style>{`@page { size: A4 ${view === "plan" ? "landscape" : "portrait"}; margin: 12mm; }
        @media print { body { background: white; } }`}</style>

      <div className="mb-6 flex flex-wrap items-center gap-2 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/app/seating?event=${layout.event_id}`}>
            <ArrowLeft className="rtl:rotate-180" aria-hidden /> {t("printPage.back")}
          </Link>
        </Button>
        <nav className="flex flex-wrap gap-1" aria-label={t("printPage.what")}>
          {VIEWS.map((v) => (
            <Link
              key={v}
              href={`?view=${v}`}
              aria-current={v === view ? "page" : undefined}
              className={cn(
                "rounded-full border px-3 py-1 text-sm",
                v === view ? "border-[#4a3f3a] bg-[#4a3f3a] text-white" : "hover:bg-[#f3ebe5]",
              )}
            >
              {t(`printViews.${v}`)}
            </Link>
          ))}
        </nav>
        <div className="ms-auto">
          <PrintControls />
        </div>
      </div>

      <PrintSeatingView
        view={view}
        title={title}
        state={state}
        guests={data.guests}
        mealOptions={data.mealOptions}
      />
    </main>
  );
}
