"use server";

import { revalidatePath } from "next/cache";
import { getWeddingContext, setCurrentWedding } from "@/lib/wedding";

/** Switches the selected wedding (for users who belong to several). */
export async function switchWedding(weddingId: string) {
  const ctx = await getWeddingContext();
  // Only allow switching to a wedding the user actually belongs to.
  if (!ctx?.weddings.some((w) => w.id === weddingId)) return;
  await setCurrentWedding(weddingId);
  revalidatePath("/app", "layout");
}
