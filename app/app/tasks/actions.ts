"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { contentTranslations } from "@/lib/i18n/content-locale";
import { missingSuggestions } from "@/lib/tasks/timeline";
import { taskSchema } from "@/lib/validation/tasks";
import { canEdit, requireUser, requireWedding } from "@/lib/wedding";
import { fail, err, invalid, noPermission } from "@/lib/errors";
import { logActivity } from "@/lib/activity";

const id = z.uuid();

async function editor() {
  const { wedding, role } = await requireWedding();
  if (!canEdit(role)) return null;
  return { wedding, sb: await createClient(), onlyOwn: false };
}

/** Helpers may only tick off to-dos assigned to them. */
async function helper() {
  const { wedding, role } = await requireWedding();
  if (role !== "helper") return null;
  return { wedding, sb: await createClient(), onlyOwn: true };
}

function done(): ActionResult {
  revalidatePath("/app/tasks");
  revalidatePath("/app");
  return { ok: true };
}

const today = () => new Date().toISOString().slice(0, 10);

export async function saveTask(taskId: string | null, input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const ctx = await editor();
  if (!ctx || (taskId && !id.safeParse(taskId).success)) return noPermission();
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return await invalid(parsed.error);
  const v = parsed.data;
  const row = {
    title: v.title,
    notes: v.notes || null,
    due_date: v.due_date || null,
    assignee_id: v.assignee_id || null,
    category: v.category || null,
  };
  if (taskId) {
    const { error } = await ctx.sb
      .from("tasks")
      .update(row)
      .eq("id", taskId)
      .eq("wedding_id", ctx.wedding.id);
    if (error) return fail("saveTask", error, error.code === "23514" ? "notMember" : undefined);
  } else {
    // new to-dos go to the end of their day's list
    const days = row.due_date ? Math.floor(Date.parse(row.due_date) / 86_400_000) : 1e6;
    const { error } = await ctx.sb.from("tasks").insert({
      ...row,
      wedding_id: ctx.wedding.id,
      created_by: user.id,
      sort_order: days + 0.999,
    });
    if (error) return fail("saveTask", error);
    logActivity(ctx.wedding.id, user.id, "task.add", v.title);
  }
  return done();
}

export async function setTaskDone(taskId: string, isDone: boolean): Promise<ActionResult> {
  if (!id.safeParse(taskId).success) return noPermission();
  const user = await requireUser();
  // Editors can tick any to-do; helpers only the ones assigned to them.
  const ctx = (await editor()) ?? (await helper());
  if (!ctx) return noPermission();
  let query = ctx.sb
    .from("tasks")
    .update({ done: isDone })
    .eq("id", taskId)
    .eq("wedding_id", ctx.wedding.id);
  if (ctx.onlyOwn) query = query.eq("assignee_id", user.id);
  const { data: changed, error } = await query.select("id");
  if (error) return fail("setTaskDone", error);
  if (!changed?.length) return noPermission();
  if (isDone) {
    const { data: task } = await ctx.sb.from("tasks").select("title").eq("id", taskId).single();
    logActivity(ctx.wedding.id, user.id, "task.done", task?.title ?? "");
  }
  return done();
}

export async function deleteTask(taskId: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !id.safeParse(taskId).success) return noPermission();
  const { error } = await ctx.sb
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("wedding_id", ctx.wedding.id);
  if (error) return fail("deleteTask", error);
  return done();
}

/** Saves a new position after drag and drop (one row). */
export async function moveTask(taskId: string, sortOrder: number): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !id.safeParse(taskId).success || !Number.isFinite(sortOrder)) return noPermission();
  const { error } = await ctx.sb
    .from("tasks")
    .update({ sort_order: sortOrder })
    .eq("id", taskId)
    .eq("wedding_id", ctx.wedding.id);
  if (error) return fail("moveTask", error);
  return done();
}

// ─── Task comments ───

export async function addComment(
  taskId: string,
  body: string,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const { wedding, role } = await requireWedding();
  if (!id.safeParse(taskId).success) return noPermission();
  const trimmed = body.trim();
  if (!trimmed || trimmed.length > 2000) return await err("generic");
  const sb = await createClient();
  const { data, error } = await sb
    .from("task_comments")
    .insert({ task_id: taskId, wedding_id: wedding.id, author_id: user.id, body: trimmed })
    .select("id")
    .single();
  if (error) return fail("addComment", error);
  logActivity(wedding.id, user.id, "comment.add");
  revalidatePath("/app/tasks");
  return { ok: true, data: { id: data.id } };
}

export async function deleteComment(commentId: string): Promise<ActionResult> {
  await requireUser();
  await requireWedding();
  if (!id.safeParse(commentId).success) return noPermission();
  const sb = await createClient();
  const { error } = await sb.from("task_comments").delete().eq("id", commentId);
  if (error) return fail("deleteComment", error);
  revalidatePath("/app/tasks");
  return { ok: true };
}

export async function loadComments(taskId: string) {
  await requireWedding();
  if (!id.safeParse(taskId).success) return [];
  const sb = await createClient();
  const { data } = await sb
    .from("task_comments")
    .select("id, body, author_id, created_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  return data ?? [];
}

/** Adds the suggested timeline (only the tasks that aren't there yet). */
export async function addSuggestedTasks(): Promise<ActionResult<{ added: number }>> {
  const user = await requireUser();
  const ctx = await editor();
  if (!ctx) return noPermission();
  if (!ctx.wedding.wedding_date) return await err("setDateFirst");
  const { data: existing, error: readError } = await ctx.sb
    .from("tasks")
    .select("suggestion_key")
    .eq("wedding_id", ctx.wedding.id)
    .not("suggestion_key", "is", null);
  if (readError) return fail("addSuggestedTasks", readError);
  const t = await contentTranslations(ctx.wedding, "tasks");
  const rows = missingSuggestions(
    new Set((existing ?? []).map((r) => r.suggestion_key!)),
    ctx.wedding.wedding_date,
    today(),
    { title: (k) => t(`suggestions.${k}`), category: (c) => t(`categories.${c}`) },
  );
  if (!rows.length) return { ok: true, data: { added: 0 } };
  const { error } = await ctx.sb.from("tasks").upsert(
    rows.map((r) => ({ ...r, wedding_id: ctx.wedding.id, created_by: user.id })),
    { onConflict: "wedding_id,suggestion_key", ignoreDuplicates: true },
  );
  if (error) return fail("addSuggestedTasks", error);
  done();
  return { ok: true, data: { added: rows.length } };
}
