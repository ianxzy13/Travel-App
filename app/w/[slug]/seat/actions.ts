"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  slug: z.string().min(3).max(60),
  name: z.string().trim().min(1).max(200),
});

export type SeatResult = {
  guestName: string;
  tableLabel: string | null;
  tableNumber: number | null;
  tableKind: string;
};

export async function findSeat(
  slug: string,
  name: string,
): Promise<ActionResult<SeatResult | null>> {
  const parsed = schema.safeParse({ slug, name });
  if (!parsed.success) return { ok: true, data: null };

  const sb = await createClient();
  const { data, error } = await sb.rpc("find_seat", {
    p_slug: parsed.data.slug,
    p_name: parsed.data.name,
  });
  if (error) return { ok: false, error: "Something went wrong. Please try again." };
  if (!data) return { ok: true, data: null };
  const r = data as { guest_name: string; table_label: string | null; table_number: number | null; table_kind: string };
  return {
    ok: true,
    data: {
      guestName: r.guest_name,
      tableLabel: r.table_label,
      tableNumber: r.table_number,
      tableKind: r.table_kind,
    },
  };
}
