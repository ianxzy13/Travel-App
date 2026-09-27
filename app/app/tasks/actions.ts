"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, type ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { missingSuggestions } from "@/lib/tasks/timeline";
import { taskSchema } from "@/lib/validation/tasks";
import { canEdit, requireUser, requireWedding } from "@/lib/wedding";

const NO_PERMISSION = {
  ok: false as const,
  error: "You don't have permission to change the to-dos.",
};
const id = z.uuid();

async function editor() {
  const { wedding, role } = await requireWedding();
  if (!canEdit(role)) return null;
  return { wedding, sb: await createClient() };
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
  if (!ctx || (taskId && !id.safeParse(taskId).success)) return NO_PERMISSION;
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
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
    if (error)
      return fail(
        "saveTask",
        error,
        error.code === "23514" ? "That person isn't part of this wedding." : undefined,
      );
  } else {
    // new to-dos go to the end of their day's list
    const days = row.due_date ? Math.floor(Date.parse(row.due_date) / 86_400_000) : 1e6;
    const { error } = await ctx.sb
      .from("tasks")
      .insert({
        ...row,
        wedding_id: ctx.wedding.id,
        created_by: user.id,
        sort_order: days + 0.999,
      });
    if (error) return fail("saveTask", error);
  }
  return done();
}

export async function setTaskDone(taskId: string, isDone: boolean): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !id.safeParse(taskId).success) return NO_PERMISSION;
  const { error } = await ctx.sb
    .from("tasks")
    .update({ done: isDone })
    .eq("id", taskId)
    .eq("wedding_id", ctx.wedding.id);
  if (error) return fail("setTaskDone", error);
  return done();
}

export async function deleteTask(taskId: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !id.safeParse(taskId).success) return NO_PERMISSION;
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
  if (!ctx || !id.safeParse(taskId).success || !Number.isFinite(sortOrder)) return NO_PERMISSION;
  const { error } = await ctx.sb
    .from("tasks")
    .update({ sort_order: sortOrder })
    .eq("id", taskId)
    .eq("wedding_id", ctx.wedding.id);
  if (error) return fail("moveTask", error);
  return done();
}

/** Adds the suggested timeline (only the tasks that aren't there yet). */
export async function addSuggestedTasks(): Promise<ActionResult<{ added: number }>> {
  const user = await requireUser();
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (!ctx.wedding.wedding_date)
    return {
      ok: false,
      error: "Set your wedding date in Settings first, so we can plan backwards from it.",
    };
  const { data: existing, error: readError } = await ctx.sb
    .from("tasks")
    .select("suggestion_key")
    .eq("wedding_id", ctx.wedding.id)
    .not("suggestion_key", "is", null);
  if (readError) return fail("addSuggestedTasks", readError);
  const rows = missingSuggestions(
    new Set((existing ?? []).map((r) => r.suggestion_key!)),
    ctx.wedding.wedding_date,
    today(),
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
