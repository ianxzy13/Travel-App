import type { Metadata } from "next";
import { TasksPage } from "@/components/tasks/tasks-page";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { loadMembers, loadProgress } from "@/lib/tasks/load";
import { SUGGESTIONS, detectDone } from "@/lib/tasks/timeline";
import { canEdit, requireUser, requireWedding } from "@/lib/wedding";

export const metadata: Metadata = { title: "To-dos" };

export default async function Tasks({ searchParams }: { searchParams: Promise<{ task?: string; show?: string }> }) {
  const user = await requireUser();
  const { wedding, role } = await requireWedding();
  const { task, show } = await searchParams;
  const sb = await createClient();
  const [tasks, members, progress] = await Promise.all([
    fetchAll((f, t) => sb.from("tasks").select("*").eq("wedding_id", wedding.id).order("sort_order").order("created_at").range(f, t)),
    loadMembers(sb, wedding.id),
    loadProgress(sb, wedding),
  ]);
  const keys = new Set(tasks.map((t) => t.suggestion_key).filter(Boolean));

  return (
    <TasksPage
      tasks={tasks}
      members={members}
      userId={user.id}
      weddingDate={wedding.wedding_date}
      canEdit={canEdit(role)}
      looksDone={detectDone(progress)}
      missingSuggestions={SUGGESTIONS.filter((s) => !keys.has(s.key)).length}
      openTaskId={task ?? null}
      initialShow={show === "overdue" ? "overdue" : "open"}
    />
  );
}
