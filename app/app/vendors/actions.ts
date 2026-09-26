"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, type ActionResult } from "@/lib/action-result";
import { isOwnFile, removeFiles } from "@/lib/files";
import { createClient } from "@/lib/supabase/server";
import { vendorSchema } from "@/lib/validation/budget";
import { canEdit, requireWedding } from "@/lib/wedding";

const NO_PERMISSION = { ok: false as const, error: "You don't have permission to change vendors." };

async function editor() {
  const { wedding, role } = await requireWedding();
  if (!canEdit(role)) return null;
  return { wedding, sb: await createClient() };
}

function done(): ActionResult {
  revalidatePath("/app/vendors");
  revalidatePath("/app/budget");
  return { ok: true };
}

export async function saveVendor(
  input: unknown,
  id?: string,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  const parsed = vendorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  const wid = ctx.wedding.id;
  if (!isOwnFile(v.contract?.path, wid)) return NO_PERMISSION;

  const row = {
    name: v.name,
    category_id: v.categoryId,
    contact_name: v.contactName || null,
    email: v.email || null,
    phone: v.phone || null,
    website: v.website || null,
    instagram: v.instagram.replace(/^@/, "") || null,
    address: v.address || null,
    quote: v.quote,
    status: v.status,
    notes: v.notes || null,
    contract_path: v.contract?.path ?? null,
    contract_name: v.contract?.name ?? null,
  };

  if (id) {
    const { data: old } = await ctx.sb
      .from("vendors")
      .select("contract_path")
      .eq("id", id)
      .eq("wedding_id", wid)
      .maybeSingle();
    if (!old) return { ok: false, error: "This vendor no longer exists." };
    const { error } = await ctx.sb.from("vendors").update(row).eq("id", id).eq("wedding_id", wid);
    if (error) return fail("saveVendor", error);
    if (old.contract_path && old.contract_path !== row.contract_path)
      await removeFiles(ctx.sb, [old.contract_path]);
    done();
    return { ok: true, data: { id } };
  }

  const { data, error } = await ctx.sb
    .from("vendors")
    .insert({ ...row, wedding_id: wid })
    .select("id")
    .single();
  if (error) return fail("saveVendor", error);
  done();
  return { ok: true, data: { id: data.id } };
}

export async function deleteVendor(id: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !z.uuid().safeParse(id).success) return NO_PERMISSION;
  // Linked expenses stay in the budget (their vendor is cleared).
  const { data, error } = await ctx.sb
    .from("vendors")
    .delete()
    .eq("id", id)
    .eq("wedding_id", ctx.wedding.id)
    .select("contract_path");
  if (error) return fail("deleteVendor", error);
  await removeFiles(
    ctx.sb,
    (data ?? []).map((r) => r.contract_path),
  );
  return done();
}

/** Turns a vendor's quote into a budget expense in the vendor's category. */
export async function addQuoteToBudget(id: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !z.uuid().safeParse(id).success) return NO_PERMISSION;
  const { data: vendor } = await ctx.sb
    .from("vendors")
    .select("name, category_id, quote")
    .eq("id", id)
    .eq("wedding_id", ctx.wedding.id)
    .maybeSingle();
  if (!vendor) return { ok: false, error: "This vendor no longer exists." };
  if (!vendor.category_id)
    return { ok: false, error: "Choose a budget category for this vendor first." };

  const { error } = await ctx.sb.from("expenses").insert({
    wedding_id: ctx.wedding.id,
    category_id: vendor.category_id,
    vendor_id: id,
    name: vendor.name,
    estimated: Number(vendor.quote ?? 0),
  });
  if (error) return fail("addQuoteToBudget", error);
  return done();
}
