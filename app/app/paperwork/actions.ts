"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { paperworkItemSchema } from "@/lib/validation/paperwork";
import { canEdit, requireWedding } from "@/lib/wedding";
import { fail, invalid, noPermission } from "@/lib/errors";
import {
  TEMPLATES,
  dueDateFromWedding,
} from "@/lib/paperwork/templates";

const idSchema = z.uuid();

async function editor() {
  const { wedding, role } = await requireWedding();
  if (!canEdit(role)) return null;
  return { wedding, sb: await createClient() };
}

function done(): ActionResult {
  revalidatePath("/app/paperwork");
  revalidatePath("/app");
  return { ok: true };
}

export async function savePaperworkItem(
  input: unknown,
  id?: string,
): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return noPermission();
  const parsed = paperworkItemSchema.safeParse(input);
  if (!parsed.success) return await invalid(parsed.error);
  const v = parsed.data;

  const row = {
    person: v.person,
    title: v.title,
    template_key: v.templateKey ?? null,
    status: v.status,
    responsible_id: v.responsibleId ?? null,
    due_date: v.dueDate || null,
    notes: v.notes || null,
    issue_date: v.issueDate || null,
    max_age_months: v.maxAgeMonths ?? null,
    sort_order: v.sortOrder,
  };

  if (id) {
    const { error } = await ctx.sb
      .from("paperwork_items")
      .update(row)
      .eq("id", id)
      .eq("wedding_id", ctx.wedding.id);
    if (error) return fail("savePaperworkItem", error);
  } else {
    const { error } = await ctx.sb
      .from("paperwork_items")
      .insert({ ...row, wedding_id: ctx.wedding.id });
    if (error) return fail("savePaperworkItem", error);
  }
  return done();
}

export async function deletePaperworkItem(
  id: string,
): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return noPermission();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return await invalid(parsed.error);

  const { data: item } = await ctx.sb
    .from("paperwork_items")
    .select("file_path")
    .eq("id", parsed.data)
    .eq("wedding_id", ctx.wedding.id)
    .maybeSingle();

  if (item?.file_path) {
    await ctx.sb.storage.from("paperwork").remove([item.file_path]);
  }

  const { error } = await ctx.sb
    .from("paperwork_items")
    .delete()
    .eq("id", parsed.data)
    .eq("wedding_id", ctx.wedding.id);
  if (error) return fail("deletePaperworkItem", error);
  return done();
}

export async function uploadScan(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return noPermission();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return await invalid(parsed.error);

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ok: false, error: "No file selected" };
  if (file.size > 10 * 1024 * 1024) return { ok: false, error: "File too large (max 10 MB)" };

  const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
  const path = `${ctx.wedding.id}/${parsed.data}.${ext}`;

  const { error: uploadError } = await ctx.sb.storage
    .from("paperwork")
    .upload(path, file, { upsert: true });
  if (uploadError) return fail("uploadScan", uploadError);

  const { error } = await ctx.sb
    .from("paperwork_items")
    .update({ file_path: path })
    .eq("id", parsed.data)
    .eq("wedding_id", ctx.wedding.id);
  if (error) return fail("uploadScan.update", error);
  return done();
}

export async function removeScan(id: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return noPermission();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return await invalid(parsed.error);

  const { data: item } = await ctx.sb
    .from("paperwork_items")
    .select("file_path")
    .eq("id", parsed.data)
    .eq("wedding_id", ctx.wedding.id)
    .maybeSingle();

  if (item?.file_path) {
    await ctx.sb.storage.from("paperwork").remove([item.file_path]);
  }

  const { error } = await ctx.sb
    .from("paperwork_items")
    .update({ file_path: null })
    .eq("id", parsed.data)
    .eq("wedding_id", ctx.wedding.id);
  if (error) return fail("removeScan", error);
  return done();
}

export async function loadFromTemplate(
  countryCode: string,
): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return noPermission();

  const template = TEMPLATES[countryCode.toUpperCase()];
  if (!template) return { ok: false, error: "No template for this country" };

  const weddingDate = ctx.wedding.wedding_date;

  const rows = template.items.map(
    (item, i: number) => ({
      wedding_id: ctx.wedding.id,
      person: item.person,
      title: item.title,
      template_key: item.key,
      status: "not_started" as const,
      due_date: weddingDate
        ? dueDateFromWedding(weddingDate, item.monthsBefore)
        : null,
      max_age_months: item.maxAgeMonths ?? null,
      sort_order: i,
    }),
  );

  const { error } = await ctx.sb.from("paperwork_items").insert(rows);
  if (error) return fail("loadFromTemplate", error);
  return done();
}

export async function createTasksFromPaperwork(): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return noPermission();

  const { data: items } = await ctx.sb
    .from("paperwork_items")
    .select("id, title, due_date, responsible_id, status")
    .eq("wedding_id", ctx.wedding.id)
    .neq("status", "submitted")
    .order("sort_order");

  if (!items || items.length === 0) return { ok: false, error: "No paperwork items" };

  const tasks = items.map((item) => ({
    wedding_id: ctx.wedding.id,
    title: item.title,
    due_date: item.due_date,
    assignee_id: item.responsible_id,
    category: "paperwork",
    link: "/app/paperwork",
    suggestion_key: `paperwork_${item.id}`,
    done: false,
    sort_order: 0,
  }));

  const { error } = await ctx.sb.from("tasks").upsert(tasks, {
    onConflict: "wedding_id,suggestion_key",
    ignoreDuplicates: true,
  });
  if (error) return fail("createTasksFromPaperwork", error);

  revalidatePath("/app/tasks");
  return done();
}
