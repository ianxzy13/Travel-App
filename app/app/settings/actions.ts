"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, type ActionResult } from "@/lib/action-result";
import type { MemberRole } from "@/lib/database.types";
import { getSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import { inviteSchema, toWeddingColumns, weddingSchema } from "@/lib/validation/wedding";
import { canEdit, requireUser, requireWedding, WEDDING_COOKIE } from "@/lib/wedding";

// Every action re-checks permissions here for friendly messages, but the real
// protection is the Row Level Security policies in the database.

const NO_PERMISSION = { ok: false as const, error: "You don't have permission to do that." };
const idSchema = z.uuid();
const roleSchema = z.enum(["owner", "editor", "viewer"]);

/** Translate the "last owner" database rule into plain English. */
function ownerError(context: string, error: { message: string }) {
  if (error.message.includes("at least one owner")) {
    return {
      ok: false as const,
      error: "Every wedding needs at least one owner. Make someone else an owner first.",
    };
  }
  return fail(context, error);
}

export async function updateWedding(input: unknown): Promise<ActionResult> {
  const { wedding, role } = await requireWedding();
  if (!canEdit(role)) return NO_PERMISSION;

  const parsed = weddingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("weddings")
    .update(toWeddingColumns(parsed.data))
    .eq("id", wedding.id)
    .select("id");

  if (error) return fail("updateWedding", error);
  if (!data.length) return NO_PERMISSION;

  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function inviteCollaborator(input: unknown): Promise<ActionResult<{ link: string }>> {
  const user = await requireUser();
  const { wedding, role } = await requireWedding();
  if (role !== "owner") return NO_PERMISSION;

  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("wedding_invitations")
    .insert({
      wedding_id: wedding.id,
      email: parsed.data.email.toLowerCase(),
      role: parsed.data.role,
      invited_by: user.id,
    })
    .select("token")
    .single();

  if (error) return fail("inviteCollaborator", error);

  // The link is shown to the owner to share (WhatsApp, email…). Possible later: send it via Resend.
  revalidatePath("/app/settings");
  return { ok: true, data: { link: `${await getSiteUrl()}/invite/${data.token}` } };
}

export async function revokeInvitation(invitationId: string): Promise<ActionResult> {
  const { wedding, role } = await requireWedding();
  if (role !== "owner" || !idSchema.safeParse(invitationId).success) return NO_PERMISSION;

  const supabase = await createClient();
  const { error } = await supabase
    .from("wedding_invitations")
    .delete()
    .eq("id", invitationId)
    .eq("wedding_id", wedding.id);

  if (error) return fail("revokeInvitation", error);
  revalidatePath("/app/settings");
  return { ok: true };
}

export async function updateMemberRole(
  memberId: string,
  newRole: MemberRole,
): Promise<ActionResult> {
  const { wedding, role } = await requireWedding();
  if (role !== "owner") return NO_PERMISSION;
  if (!idSchema.safeParse(memberId).success || !roleSchema.safeParse(newRole).success) {
    return NO_PERMISSION;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("wedding_members")
    .update({ role: newRole })
    .eq("id", memberId)
    .eq("wedding_id", wedding.id)
    .select("id");

  if (error) return ownerError("updateMemberRole", error);
  if (!data.length) return NO_PERMISSION;

  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function removeMember(memberId: string): Promise<ActionResult> {
  const { wedding, role } = await requireWedding();
  if (role !== "owner" || !idSchema.safeParse(memberId).success) return NO_PERMISSION;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("wedding_members")
    .delete()
    .eq("id", memberId)
    .eq("wedding_id", wedding.id)
    .select("id");

  if (error) return ownerError("removeMember", error);
  if (!data.length) return NO_PERMISSION;

  revalidatePath("/app/settings");
  return { ok: true };
}

/** Removes yourself from the current wedding. */
export async function leaveWedding(): Promise<ActionResult> {
  const user = await requireUser();
  const { wedding } = await requireWedding();

  const supabase = await createClient();
  const { error } = await supabase
    .from("wedding_members")
    .delete()
    .eq("wedding_id", wedding.id)
    .eq("user_id", user.id);

  if (error) return ownerError("leaveWedding", error);

  (await cookies()).delete(WEDDING_COOKIE);
  redirect("/app");
}

export async function deleteWedding(): Promise<ActionResult> {
  const { wedding, role } = await requireWedding();
  if (role !== "owner") return NO_PERMISSION;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("weddings")
    .delete()
    .eq("id", wedding.id)
    .select("id");

  if (error) return fail("deleteWedding", error);
  if (!data.length) return NO_PERMISSION;

  (await cookies()).delete(WEDDING_COOKIE);
  redirect("/app");
}
