import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { GiftsPage } from "@/components/gifts/gifts-page";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { canEdit, requireWedding } from "@/lib/wedding";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("app.nav"))("gifts") };
}

export default async function Gifts() {
  const { wedding, role } = await requireWedding();
  const sb = await createClient();
  const [gifts, households] = await Promise.all([
    fetchAll((f, t) =>
      sb
        .from("gifts")
        .select("*")
        .eq("wedding_id", wedding.id)
        .order("received_on", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .range(f, t),
    ),
    fetchAll((f, t) =>
      sb
        .from("households")
        .select("id, name")
        .eq("wedding_id", wedding.id)
        .order("name")
        .range(f, t),
    ),
  ]);

  return (
    <GiftsPage
      gifts={gifts.map((g) => ({ ...g, amount: g.amount == null ? null : Number(g.amount) }))}
      households={households}
      currency={wedding.currency}
      canEdit={canEdit(role)}
    />
  );
}
