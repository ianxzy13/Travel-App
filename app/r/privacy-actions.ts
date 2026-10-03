"use server";

import { getTranslations } from "next-intl/server";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const codeSchema = z.string().trim().min(6).max(10);

async function loadHousehold(code: string) {
  const supabase = await createClient();
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const { data } = await supabase
    .from("households")
    .select("id, wedding_id, name")
    .eq("rsvp_code", clean)
    .single();
  return data;
}

export async function downloadMyData(code: string): Promise<ActionResult<object>> {
  const t = await getTranslations("rsvp.errors");
  if (!codeSchema.safeParse(code).success) return { ok: false, error: t("rsvp_not_found") };

  const h = await loadHousehold(code);
  if (!h) return { ok: false, error: t("rsvp_not_found") };

  const supabase = await createClient();
  const [guests, responses, travel] = await Promise.all([
    supabase
      .from("guests")
      .select("first_name, last_name, email, phone, dietary, age_group, wants_hotel_room, needs_crib, room_pref_share, room_pref_avoid")
      .eq("household_id", h.id),
    supabase
      .from("rsvp_responses")
      .select("guest_id, event_id, status, meal_option_id")
      .eq("wedding_id", h.wedding_id)
      .in("guest_id", (
        await supabase.from("guests").select("id").eq("household_id", h.id)
      ).data?.map((g) => g.id) ?? []),
    supabase
      .from("guest_travel")
      .select("*")
      .eq("household_id", h.id),
  ]);

  return {
    ok: true,
    data: {
      household: h.name,
      guests: guests.data ?? [],
      rsvp_responses: responses.data ?? [],
      travel: travel.data ?? [],
      exported_at: new Date().toISOString(),
    },
  };
}

export async function deleteMyData(code: string): Promise<ActionResult> {
  const t = await getTranslations("rsvp.privacy");
  if (!codeSchema.safeParse(code).success) return { ok: false, error: t("error") };

  const h = await loadHousehold(code);
  if (!h) return { ok: false, error: t("error") };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: t("error") };

  const { data: guestIds } = await admin
    .from("guests")
    .select("id")
    .eq("household_id", h.id);
  const ids = guestIds?.map((g) => g.id) ?? [];

  if (ids.length > 0) {
    await admin.from("seat_assignments").delete().in("guest_id", ids);
    await admin.from("hotel_room_assignments").delete().in("guest_id", ids);
    await admin.from("rsvp_responses").delete().in("guest_id", ids);
  }

  await admin.from("guest_travel").delete().eq("household_id", h.id);

  await admin
    .from("guests")
    .update({
      first_name: "Guest",
      last_name: "removed",
      email: null,
      phone: null,
      dietary: null,
      accessibility: null,
      notes: null,
      dietary_consent: false,
      dietary_consent_at: null,
      room_pref_share: null,
      room_pref_avoid: null,
    })
    .eq("household_id", h.id);

  await admin
    .from("households")
    .update({
      address_line1: null,
      address_line2: null,
      city: null,
      region: null,
      postal_code: null,
      country: null,
      notes: null,
      rsvp_message: null,
      rsvp_song_request: null,
    })
    .eq("id", h.id);

  await notifyCoupleOfDeletion(h.wedding_id, h.name).catch((e) =>
    console.error("[deleteMyData notify]", e),
  );

  return { ok: true };
}

async function notifyCoupleOfDeletion(weddingId: string, householdName: string) {
  const admin = createAdminClient();
  if (!admin) return;

  const { data: members } = await admin
    .from("wedding_members")
    .select("user_id, role")
    .eq("wedding_id", weddingId)
    .in("role", ["owner", "editor"]);

  if (!members?.length) return;

  for (const m of members) {
    await admin.from("notifications").insert({
      wedding_id: weddingId,
      user_id: m.user_id,
      type: "rsvp",
      title: `${householdName} requested data deletion`,
      body: "Their personal details have been removed. An anonymous placeholder remains.",
      link: "/app/guests",
    });
  }
}
