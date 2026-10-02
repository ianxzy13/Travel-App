"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { giftSchema } from "@/lib/validation/gifts";
import { canEdit, requireWedding } from "@/lib/wedding";
import { fail, invalid, noPermission } from "@/lib/errors";

const idSchema = z.uuid();

async function editor() {
  const { wedding, role } = await requireWedding();
  if (!canEdit(role)) return null;
  return { wedding, sb: await createClient() };
}

function done(): ActionResult {
  revalidatePath("/app/gifts");
  revalidatePath("/app");
  return { ok: true };
}

export async function saveGift(input: unknown, id?: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return noPermission();
  const parsed = giftSchema.safeParse(input);
  if (!parsed.success) return await invalid(parsed.error);
  const v = parsed.data;

  const row = {
    description: v.description,
    amount: v.amount,
    household_id: v.householdId,
    from_name: v.fromName,
    category: v.category,
    received_on: v.receivedOn || null,
    thank_you_sent: v.thankYouSent,
    thank_you_sent_on: v.thankYouSentOn || null,
    notes: v.notes || null,
  };

  if (id) {
    const { error } = await ctx.sb
      .from("gifts")
      .update(row)
      .eq("id", id)
      .eq("wedding_id", ctx.wedding.id);
    if (error) return fail("saveGift", error);
  } else {
    const { error } = await ctx.sb
      .from("gifts")
      .insert({ ...row, wedding_id: ctx.wedding.id });
    if (error) return fail("saveGift", error);
  }
  return done();
}

export async function deleteGift(id: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return noPermission();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return await invalid(parsed.error);
  const { error } = await ctx.sb
    .from("gifts")
    .delete()
    .eq("id", parsed.data)
    .eq("wedding_id", ctx.wedding.id);
  if (error) return fail("deleteGift", error);
  return done();
}

export async function toggleThankYou(id: string, sent: boolean): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return noPermission();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return await invalid(parsed.error);
  const { error } = await ctx.sb
    .from("gifts")
    .update({
      thank_you_sent: sent,
      thank_you_sent_on: sent ? new Date().toISOString().slice(0, 10) : null,
    })
    .eq("id", parsed.data)
    .eq("wedding_id", ctx.wedding.id);
  if (error) return fail("toggleThankYou", error);
  return done();
}
