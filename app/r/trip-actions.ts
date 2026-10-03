"use server";

import { createClient } from "@/lib/supabase/server";

export async function toggleChecklistItem(code: string, itemKey: string, done: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("toggle_checklist_item", {
    p_code: code,
    p_item_key: itemKey,
    p_done: done,
  });
  if (error) throw new Error(error.message);
}
