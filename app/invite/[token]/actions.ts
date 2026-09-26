"use server";

import { redirect } from "next/navigation";
import { fail, type ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { requireUser, setCurrentWedding } from "@/lib/wedding";

export async function acceptInvitation(token: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { data: weddingId, error } = await supabase.rpc("accept_invitation", {
    invite_token: token,
  });

  if (error || !weddingId) {
    return fail("acceptInvitation", error, "This invitation is invalid or has expired.");
  }

  await setCurrentWedding(weddingId);
  redirect("/app");
}
