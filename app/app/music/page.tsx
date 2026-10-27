import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { MusicPage } from "@/components/music/music-page";
import { fmtDate } from "@/lib/i18n/format";
import { loadMusic } from "@/lib/music/load";
import { createClient } from "@/lib/supabase/server";
import { canEdit, coupleName, requireWedding } from "@/lib/wedding";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("music"))("title") };
}

export default async function Music() {
  const { wedding, role } = await requireWedding();
  const sb = await createClient();
  const locale = await getLocale();
  const editable = canEdit(role);
  const data = await loadMusic(sb, wedding, locale, editable);
  return (
    <MusicPage
      {...data}
      couple={coupleName(wedding)}
      dateLabel={wedding.wedding_date ? fmtDate(wedding.wedding_date, locale, "long") : null}
      canEdit={editable}
    />
  );
}
