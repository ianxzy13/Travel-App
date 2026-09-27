import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { InspirationPage } from "@/components/inspiration/inspiration-page";
import { loadInspiration } from "@/lib/inspiration/load";
import { isUnsplashConfigured } from "@/lib/inspiration/unsplash";
import { createClient } from "@/lib/supabase/server";
import { canEdit, requireUser, requireWedding } from "@/lib/wedding";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("app.nav"))("inspiration") };
}

export default async function Inspiration() {
  const user = await requireUser();
  const { wedding, role } = await requireWedding();
  const sb = await createClient();
  const [data, { data: categories }, { data: vendors }] = await Promise.all([
    loadInspiration(sb, wedding.id),
    sb
      .from("budget_categories")
      .select("id, name")
      .eq("wedding_id", wedding.id)
      .order("sort_order"),
    sb.from("vendors").select("id, name").eq("wedding_id", wedding.id).order("name"),
  ]);

  return (
    <InspirationPage
      {...data}
      categories={categories ?? []}
      vendors={vendors ?? []}
      weddingId={wedding.id}
      userId={user.id}
      canEdit={canEdit(role)}
      unsplashEnabled={isUnsplashConfigured}
    />
  );
}
