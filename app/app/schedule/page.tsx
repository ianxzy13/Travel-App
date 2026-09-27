import type { Metadata } from "next";
import { SchedulePage } from "@/components/schedule/schedule-page";
import { createClient } from "@/lib/supabase/server";
import { canEdit, requireWedding } from "@/lib/wedding";

export const metadata: Metadata = { title: "Day-of schedule" };

export default async function Schedule() {
  const { wedding, role } = await requireWedding();
  const sb = await createClient();
  const [{ data: items }, { data: events }, { data: vendors }] = await Promise.all([
    sb.from("schedule_items").select("*").eq("wedding_id", wedding.id).order("start_time"),
    sb
      .from("events")
      .select("id, name, event_date, start_time")
      .eq("wedding_id", wedding.id)
      .order("event_date"),
    sb
      .from("vendors")
      .select("id, name, contact_name, phone")
      .eq("wedding_id", wedding.id)
      .neq("status", "rejected")
      .order("name"),
  ]);

  return (
    <SchedulePage
      items={items ?? []}
      events={events ?? []}
      vendors={vendors ?? []}
      weddingDate={wedding.wedding_date}
      canEdit={canEdit(role)}
    />
  );
}
