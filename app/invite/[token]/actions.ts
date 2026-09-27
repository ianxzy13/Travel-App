"use server";

import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { requireUser, setCurrentWedding } from "@/lib/wedding";
import { fail } from "@/lib/errors";

export async function acceptInvitation(token: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { data: weddingId, error } = await supabase.rpc("accept_invitation", {
    invite_token: token,
  });

  if (error || !weddingId) {
    return fail("acceptInvitation", error, "invitationInvalid");
  }

  await setCurrentWedding(weddingId);
  redirect("/app");
}
