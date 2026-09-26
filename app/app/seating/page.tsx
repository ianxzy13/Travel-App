import type { Metadata } from "next";
import Link from "next/link";
import { Armchair } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { SeatingEditor } from "@/components/seating/seating-editor";
import { Button } from "@/components/ui/button";
import { getOrCreateLayout, loadSeatingData } from "@/lib/seating/load";
import { createClient } from "@/lib/supabase/server";
import { canEdit, requireWedding } from "@/lib/wedding";

export const metadata: Metadata = { title: "Seating chart" };

export default async function SeatingPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const { wedding, role } = await requireWedding();
  const editable = canEdit(role);
  const supabase = await createClient();
  const { data: events } = await supabase
    .from("events")
    .select("id, name, meal_choice")
    .eq("wedding_id", wedding.id)
    .order("sort_order");

  if (!events?.length) {
    return (
      <>
        <PageHeader title="Seating chart" />
        <Empty text="Add an event (like your reception) first, then plan its seating here.">
          <Button asChild>
            <Link href="/app/settings#events">Add events</Link>
          </Button>
        </Empty>
      </>
    );
  }

  // Default to the event asking for meals (usually the reception), else the last one.
  const { event: requested } = await searchParams;
  const event =
    events.find((e) => e.id === requested) ??
    events.find((e) => e.meal_choice) ??
    events[events.length - 1];

  const layout = await getOrCreateLayout(supabase, wedding.id, event.id, editable);
  if (!layout) {
    return (
      <>
        <PageHeader title="Seating chart" />
        <Empty text="The couple hasn't started the seating chart for this event yet." />
      </>
    );
  }
  const data = await loadSeatingData(supabase, layout);

  return (
    <SeatingEditor
      // a fresh editor per floor plan (switching events or weddings)
      key={layout.id}
      layoutId={layout.id}
      eventId={event.id}
      events={events.map((e) => ({ id: e.id, name: e.name }))}
      initial={data.state}
      guests={data.guests}
      relationships={data.relationships}
      tags={data.tags}
      mealOptions={data.mealOptions}
      names={{ a: wedding.partner_a_name, b: wedding.partner_b_name }}
      canEdit={editable}
    />
  );
}

function Empty({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <div className="bg-card flex flex-col items-center gap-4 rounded-2xl border border-dashed px-6 py-16 text-center">
      <span className="bg-primary-soft text-primary inline-flex size-14 items-center justify-center rounded-full">
        <Armchair className="size-7" aria-hidden />
      </span>
      <p className="text-muted-foreground max-w-sm">{text}</p>
      {children}
    </div>
  );
}
