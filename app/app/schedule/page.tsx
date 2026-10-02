import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { SchedulePage } from "@/components/schedule/schedule-page";
import { starterTexts } from "@/lib/i18n/defaults";
import { createClient } from "@/lib/supabase/server";
import { canEdit, requireWedding } from "@/lib/wedding";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("app.nav"))("schedule") };
}

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

  // starter texts nobody has changed are shown in the viewer's language
  const shown = await starterTexts(await getLocale());
  return (
    <SchedulePage
      items={(items ?? []).map((i) => ({
        ...i,
        title: shown(i.title, "schedule.template"),
        owner: shown(i.owner, "schedule.owners"),
      }))}
      events={(events ?? []).map((e) => ({ ...e, name: shown(e.name) }))}
      vendors={vendors ?? []}
      weddingDate={wedding.wedding_date}
      canEdit={canEdit(role)}
    />
  );
}
