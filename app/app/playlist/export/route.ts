import { redirect } from "next/navigation";
import { hasFeature } from "@/lib/billing/server";
import { format } from "date-fns";
import { getLocale, getTranslations } from "next-intl/server";
import { starterTexts } from "@/lib/i18n/defaults";
import { groupSongs } from "@/lib/playlist/songs";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { requireWedding } from "@/lib/wedding";
import { XLSX_TYPE, buildXlsx } from "@/lib/xlsx/build";

/** GET /app/playlist/export → the playlist as an Excel file, in the same order as the page. */
export async function GET() {
  const { wedding } = await requireWedding();
  if (!(await hasFeature(wedding.id, "exports"))) redirect("/app/billing?need=exports");
  const sb = await createClient();
  const w = wedding.id;
  const [categories, songs, shown, t] = await Promise.all([
    fetchAll((f, to) =>
      sb
        .from("playlist_categories")
        .select("id, name")
        .eq("wedding_id", w)
        .order("sort_order")
        .order("created_at")
        .range(f, to),
    ),
    fetchAll((f, to) =>
      sb
        .from("playlist_songs")
        .select("id, category_id, title, artist, priority")
        .eq("wedding_id", w)
        .order("created_at")
        .range(f, to),
    ),
    getLocale().then(starterTexts),
    getTranslations("playlist"),
  ]);

  const rows = [
    [t("field.title"), t("field.artist"), t("field.category"), t("field.priority")],
    ...groupSongs(categories, songs, "all").flatMap(({ category, songs: list }) =>
      list.map((s) => [
        s.title,
        s.artist,
        shown(category.name, "playlist.defaults"),
        t(`priority.${s.priority}`),
      ]),
    ),
  ];

  const name = `${t("title")}-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
  const ascii = name.normalize("NFD").replace(/[^\w.-]+/g, "") || "playlist.xlsx";
  return new Response(buildXlsx(t("title"), rows), {
    headers: {
      "Content-Type": XLSX_TYPE,
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "no-store",
    },
  });
}
