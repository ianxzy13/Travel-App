import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { MemberRole, WeddingRow } from "@/lib/database.types";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

/** Remembers which wedding is selected (for planners with several). */
export const WEDDING_COOKIE = "vow_wedding";

export type WeddingSummary = { id: string; name: string; date: string | null; role: MemberRole };

export type WeddingContext = {
  wedding: WeddingRow;
  role: MemberRole;
  weddings: WeddingSummary[];
};

export function coupleName(w: Pick<WeddingRow, "partner_a_name" | "partner_b_name">) {
  return `${w.partner_a_name} & ${w.partner_b_name}`;
}

export const canEdit = (role: MemberRole) => role === "owner" || role === "editor";

// `cache` makes these run once per request even if several components call them.

export const getUser = cache(async () => {
  // Before .env.local is set up, treat everyone as signed out (login shows setup help).
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const requireUser = cache(async () => {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
});

/** All weddings the user belongs to, plus the currently selected one. */
export const getWeddingContext = cache(async (): Promise<WeddingContext | null> => {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("wedding_members")
    .select("role, wedding:weddings(*)")
    .eq("user_id", user.id)
    .order("created_at");

  if (error) throw error;

  const memberships = (data ?? []).flatMap((m) =>
    m.wedding ? [{ ...m, wedding: m.wedding }] : [],
  );
  if (memberships.length === 0) return null;

  const preferredId = (await cookies()).get(WEDDING_COOKIE)?.value;
  const current = memberships.find((m) => m.wedding.id === preferredId) ?? memberships[0];

  return {
    wedding: current.wedding,
    role: current.role,
    weddings: memberships.map((m) => ({
      id: m.wedding.id,
      name: coupleName(m.wedding),
      date: m.wedding.wedding_date,
      role: m.role,
    })),
  };
});

/** Use in /app pages: sends users without a wedding to onboarding. */
export const requireWedding = cache(async () => {
  const ctx = await getWeddingContext();
  if (!ctx) redirect("/onboarding");
  return ctx;
});

export async function setCurrentWedding(weddingId: string) {
  (await cookies()).set(WEDDING_COOKIE, weddingId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
}
