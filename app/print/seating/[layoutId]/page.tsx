import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PrintControls } from "@/components/seating/print-controls";
import { PrintSeatingView, VIEWS, type ViewKey } from "@/components/seating/print-view";
import { Button } from "@/components/ui/button";
import { loadSeatingData } from "@/lib/seating/load";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { coupleName, requireUser } from "@/lib/wedding";

export const metadata: Metadata = { title: "Print seating", robots: { index: false } };

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
  const view: ViewKey = requested && requested in VIEWS ? (requested as ViewKey) : "plan";

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
    <main className="mx-auto max-w-5xl bg-white p-6 text-stone-900 print:max-w-none print:p-0">
      {/* page setup: landscape for the floor plan */}
      <style>{`@page { size: A4 ${view === "plan" ? "landscape" : "portrait"}; margin: 12mm; }
        @media print { body { background: white; } }`}</style>

      <div className="mb-6 flex flex-wrap items-center gap-2 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/app/seating?event=${layout.event_id}`}>
            <ArrowLeft aria-hidden /> Back to seating
          </Link>
        </Button>
        <nav className="flex flex-wrap gap-1" aria-label="What to print">
          {(Object.keys(VIEWS) as ViewKey[]).map((v) => (
            <Link
              key={v}
              href={`?view=${v}`}
              aria-current={v === view ? "page" : undefined}
              className={cn(
                "rounded-full border px-3 py-1 text-sm",
                v === view ? "border-stone-900 bg-stone-900 text-white" : "hover:bg-stone-100",
              )}
            >
              {VIEWS[v]}
            </Link>
          ))}
        </nav>
        <div className="ml-auto">
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
