"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { suggestedAllocations } from "@/lib/budget/suggested";
import { contentTranslations } from "@/lib/i18n/content-locale";
import { isOwnFile, removeFiles } from "@/lib/files";
import { createClient } from "@/lib/supabase/server";
import { categorySchema, expenseSchema } from "@/lib/validation/budget";
import { canEdit, requireWedding } from "@/lib/wedding";
import { fail, err, invalid, noPermission } from "@/lib/errors";

const idSchema = z.uuid();

async function editor() {
  const { wedding, role } = await requireWedding();
  if (!canEdit(role)) return null;
  return { wedding, sb: await createClient() };
}

function done(): ActionResult {
  revalidatePath("/app/budget");
  revalidatePath("/app/vendors");
  revalidatePath("/app");
  return { ok: true };
}

const today = () => new Date().toISOString().slice(0, 10);

export async function setBudgetTotal(total: number | null): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return noPermission();
  if (total !== null && !(Number.isFinite(total) && total >= 0 && total < 1e10)) {
    return await err("badAmount");
  }
  const { error } = await ctx.sb
    .from("weddings")
    .update({ budget_total: total })
    .eq("id", ctx.wedding.id);
  if (error) return fail("setBudgetTotal", error);
  return done();
}

/** Adds the suggested categories that don't exist yet, split across the total. */
export async function addSuggestedCategories(): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return noPermission();
  const { data: existing } = await ctx.sb
    .from("budget_categories")
    .select("name")
    .eq("wedding_id", ctx.wedding.id);
  const have = new Set((existing ?? []).map((c) => c.name.toLowerCase()));
  const total = ctx.wedding.budget_total == null ? null : Number(ctx.wedding.budget_total);
  const t = await contentTranslations(ctx.wedding, "budget");
  const rows = suggestedAllocations(total, (k) => t(`suggested.${k}`))
    .map((c, i) => ({
      wedding_id: ctx.wedding.id,
      name: c.name,
      allocated: c.allocated,
      sort_order: i,
    }))
    .filter((c) => !have.has(c.name.toLowerCase()));
  if (!rows.length) return { ok: true };
  const { error } = await ctx.sb.from("budget_categories").insert(rows);
  if (error) return fail("addSuggestedCategories", error);
  return done();
}

export async function saveCategory(input: unknown, id?: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return noPermission();
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return await invalid(parsed.error);

  if (id) {
    const { error } = await ctx.sb
      .from("budget_categories")
      .update(parsed.data)
      .eq("id", id)
      .eq("wedding_id", ctx.wedding.id);
    if (error) return fail("saveCategory", error);
  } else {
    const { count } = await ctx.sb
      .from("budget_categories")
      .select("id", { count: "exact", head: true })
      .eq("wedding_id", ctx.wedding.id);
    const { error } = await ctx.sb
      .from("budget_categories")
      .insert({ ...parsed.data, wedding_id: ctx.wedding.id, sort_order: count ?? 0 });
    if (error) return fail("saveCategory", error);
  }
  return done();
}

/** Deletes a category with its expenses and payments (and their receipt files). */
export async function deleteCategory(id: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !idSchema.safeParse(id).success) return noPermission();
  const { data: receipts } = await ctx.sb
    .from("expenses")
    .select("receipt_path")
    .eq("category_id", id)
    .eq("wedding_id", ctx.wedding.id);
  const { error } = await ctx.sb
    .from("budget_categories")
    .delete()
    .eq("id", id)
    .eq("wedding_id", ctx.wedding.id);
  if (error) return fail("deleteCategory", error);
  await removeFiles(
    ctx.sb,
    (receipts ?? []).map((r) => r.receipt_path),
  );
  return done();
}

/** Creates or updates an expense and replaces its payment schedule. */
export async function saveExpense(
  input: unknown,
  id?: string,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await editor();
  if (!ctx) return noPermission();
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) return await invalid(parsed.error);
  const v = parsed.data;
  const wid = ctx.wedding.id;
  if (!isOwnFile(v.receipt?.path, wid)) return noPermission();

  const row = {
    category_id: v.categoryId,
    vendor_id: v.vendorId,
    name: v.name,
    estimated: v.estimated,
    actual: v.actual,
    notes: v.notes || null,
    receipt_path: v.receipt?.path ?? null,
    receipt_name: v.receipt?.name ?? null,
  };

  let oldReceipt: string | null = null;
  let expenseId = id;
  if (expenseId) {
    const { data: old } = await ctx.sb
      .from("expenses")
      .select("receipt_path")
      .eq("id", expenseId)
      .eq("wedding_id", wid)
      .maybeSingle();
    if (!old) return await err("notFound");
    oldReceipt = old.receipt_path;
    const { error } = await ctx.sb
      .from("expenses")
      .update(row)
      .eq("id", expenseId)
      .eq("wedding_id", wid);
    if (error) return fail("saveExpense", error);
  } else {
    const { data, error } = await ctx.sb
      .from("expenses")
      .insert({ ...row, wedding_id: wid })
      .select("id")
      .single();
    if (error) return fail("saveExpense", error);
    expenseId = data.id;
  }

  // The schedule is small, so simply replace it.
  const { error: delError } = await ctx.sb.from("payments").delete().eq("expense_id", expenseId);
  if (delError) return fail("saveExpense payments", delError);
  if (v.payments.length) {
    const { error } = await ctx.sb.from("payments").insert(
      v.payments.map((p) => ({
        wedding_id: wid,
        expense_id: expenseId!,
        amount: p.amount,
        due_date: p.dueDate || null,
        paid: p.paid,
        paid_on: p.paid ? p.paidOn || today() : null,
        note: p.note || null,
      })),
    );
    if (error) return fail("saveExpense payments", error);
  }

  if (oldReceipt && oldReceipt !== row.receipt_path) await removeFiles(ctx.sb, [oldReceipt]);
  done();
  return { ok: true, data: { id: expenseId } };
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !idSchema.safeParse(id).success) return noPermission();
  const { data, error } = await ctx.sb
    .from("expenses")
    .delete()
    .eq("id", id)
    .eq("wedding_id", ctx.wedding.id)
    .select("receipt_path");
  if (error) return fail("deleteExpense", error);
  await removeFiles(
    ctx.sb,
    (data ?? []).map((r) => r.receipt_path),
  );
  return done();
}

export async function setPaymentPaid(id: string, paid: boolean): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !idSchema.safeParse(id).success) return noPermission();
  const { error } = await ctx.sb
    .from("payments")
    .update({ paid, paid_on: paid ? today() : null })
    .eq("id", id)
    .eq("wedding_id", ctx.wedding.id);
  if (error) return fail("setPaymentPaid", error);
  return done();
}
