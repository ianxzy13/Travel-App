import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PhotosPage } from "@/components/photos/photos-page";
import { getSiteUrl } from "@/lib/site-url";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { canEdit, requireWedding } from "@/lib/wedding";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("app.nav"))("photos") };
}

export default async function Photos() {
  const { wedding, role } = await requireWedding();
  const [sb, siteUrl] = await Promise.all([createClient(), getSiteUrl()]);
  const photos = await fetchAll((f, t) =>
    sb
      .from("wedding_photos")
      .select("*")
      .eq("wedding_id", wedding.id)
      .order("created_at", { ascending: false })
      .range(f, t),
  );

  return (
    <PhotosPage
      photos={photos}
      enabled={wedding.photos_enabled}
      slug={wedding.slug}
      shareUrl={`${siteUrl}/w/${wedding.slug}/photos`}
      canEdit={canEdit(role)}
    />
  );
}
