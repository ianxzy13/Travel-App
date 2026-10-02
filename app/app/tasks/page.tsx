import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { TasksPage } from "@/components/tasks/tasks-page";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { loadMembers, loadProgress } from "@/lib/tasks/load";
import { contentLocale } from "@/lib/i18n/content-locale";
import { starterTexts } from "@/lib/i18n/defaults";
import { SUGGESTED_CATEGORIES } from "@/lib/budget/suggested";
import { SUGGESTIONS, detectDone } from "@/lib/tasks/timeline";
import { canEdit, requireUser, requireWedding } from "@/lib/wedding";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("app.nav"))("tasks") };
}

export default async function Tasks({
  searchParams,
}: {
  searchParams: Promise<{ task?: string; show?: string }>;
}) {
  const user = await requireUser();
  const { wedding, role } = await requireWedding();
  const { task, show } = await searchParams;
  const sb = await createClient();
  const [rows, members, progress, shown] = await Promise.all([
    fetchAll((f, t) =>
      sb
        .from("tasks")
        .select("*")
        .eq("wedding_id", wedding.id)
        .order("sort_order")
        .order("created_at")
        .range(f, t),
    ),
    loadMembers(sb, wedding.id),
    loadProgress(sb, wedding),
    starterTexts(await getLocale()),
  ]);
  // suggested to-dos nobody has renamed are shown in the viewer's language
  const tasks = rows.map((t) => ({
    ...t,
    title: shown(t.title, "tasks.suggestions"),
    category: shown(t.category, "tasks.categories"),
  }));
  const keys = new Set(tasks.map((t) => t.suggestion_key).filter(Boolean));
  // "looks done" reasons in the viewer's language; vendor categories are matched
  // in the couple's language too (that's what the budget categories are named in)
  const tt = await getTranslations("tasks");
  const bt = await getTranslations({ locale: contentLocale(wedding), namespace: "budget" });
  // categories saved in another language (e.g. created while the app was in
  // English) still count: compare them in the couple's language
  const inCoupleLanguage = await starterTexts(contentLocale(wedding));
  const done = detectDone(
    {
      ...progress,
      bookedVendorCategories: progress.bookedVendorCategories.map((n) =>
        inCoupleLanguage(n, "budget.suggested"),
      ),
    },
    Object.fromEntries(SUGGESTED_CATEGORIES.map((c) => [c.key, bt(`suggested.${c.key}`)])),
  );
  const looksDone = Object.fromEntries(
    Object.entries(done).map(([key, d]) => [
      key,
      d.reason === "vendor"
        ? tt("reasons.vendor", { category: d.category })
        : tt(`reasons.${d.reason}`, { count: d.count ?? 0 }),
    ]),
  );

  return (
    <TasksPage
      tasks={tasks}
      members={members}
      userId={user.id}
      weddingDate={wedding.wedding_date}
      canEdit={canEdit(role)}
      looksDone={looksDone}
      missingSuggestions={SUGGESTIONS.filter((s) => !keys.has(s.key)).length}
      openTaskId={task ?? null}
      initialShow={show === "overdue" ? "overdue" : "open"}
    />
  );
}
