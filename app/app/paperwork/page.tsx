import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PaperworkPage } from "@/components/paperwork/paperwork-page";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { canEdit, requireWedding } from "@/lib/wedding";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("app.nav"))("paperwork") };
}

export default async function Paperwork() {
  const { wedding, role } = await requireWedding();
  const sb = await createClient();
  const [items, members] = await Promise.all([
    fetchAll((f, t) =>
      sb
        .from("paperwork_items")
        .select("*")
        .eq("wedding_id", wedding.id)
        .order("sort_order")
        .order("created_at")
        .range(f, t),
    ),
    sb
      .from("wedding_members")
      .select("user_id, profile:profiles(full_name)")
      .eq("wedding_id", wedding.id)
      .order("created_at")
      .then(({ data }) => data ?? []),
  ]);

  return (
    <PaperworkPage
      items={items.map((i) => ({
        ...i,
        max_age_months: i.max_age_months == null ? null : Number(i.max_age_months),
      }))}
      members={members.map((m) => ({
        id: m.user_id,
        name: (m.profile as { full_name: string | null } | null)?.full_name ?? "—",
      }))}
      partnerA={wedding.partner_a_name}
      partnerB={wedding.partner_b_name}
      canEdit={canEdit(role)}
    />
  );
}
