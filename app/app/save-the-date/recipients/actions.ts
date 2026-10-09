"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import type { StdSendMethod } from "@/lib/database.types";
import { fail, noPermission } from "@/lib/errors";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { canEdit, requireWedding } from "@/lib/wedding";

async function editor() {
  const { wedding, role } = await requireWedding();
  if (!canEdit(role)) return null;
  return { wedding, supabase: await createClient() };
}

export type RecipientRow = {
  householdId: string;
  householdName: string;
  country: string | null;
  language: string | null;
  guestNames: string[];
  emails: string[];
  phones: string[];
  side: string;
  tags: string[];
  events: string[];
  declined: boolean;
  method: StdSendMethod | null;
  methodOverride: boolean;
  status: string;
  token: string | null;
  sendId: string | null;
  toAddress: string | null;
  error: string | null;
};

export type RecipientSummary = {
  total: number;
  byEmail: number;
  bySms: number;
  noContact: number;
  alreadySent: number;
  declined: number;
};

export async function loadRecipients(): Promise<ActionResult<{
  recipients: RecipientRow[];
  summary: RecipientSummary;
  events: { id: string; name: string }[];
  tags: { id: string; name: string }[];
  stdId: string | null;
}>> {
  const ctx = await editor();
  if (!ctx) return noPermission();
  const { wedding, supabase } = ctx;

  const { data: std } = await supabase
    .from("save_the_dates")
    .select("id")
    .eq("wedding_id", wedding.id)
    .maybeSingle();

  const [households, guests, guestTags, eventInvites, rsvpResponses, events, tags, sends] =
    await Promise.all([
      fetchAll((f, t) =>
        supabase
          .from("households")
          .select("id, name, country, preferred_language")
          .eq("wedding_id", wedding.id)
          .order("name")
          .range(f, t),
      ),
      fetchAll((f, t) =>
        supabase
          .from("guests")
          .select("id, household_id, first_name, last_name, email, phone, side")
          .eq("wedding_id", wedding.id)
          .is("plus_one_of", null)
          .order("id")
          .range(f, t),
      ),
      fetchAll((f, t) =>
        supabase
          .from("guest_tags")
          .select("guest_id, tag_id")
          .eq("wedding_id", wedding.id)
          .order("id")
          .range(f, t),
      ),
      fetchAll((f, t) =>
        supabase
          .from("guest_event_invites")
          .select("guest_id, event_id")
          .eq("wedding_id", wedding.id)
          .order("id")
          .range(f, t),
      ),
      fetchAll((f, t) =>
        supabase
          .from("rsvp_responses")
          .select("guest_id, status")
          .eq("wedding_id", wedding.id)
          .order("id")
          .range(f, t),
      ),
      supabase
        .from("events")
        .select("id, name")
        .eq("wedding_id", wedding.id)
        .order("sort_order")
        .then((r) => r.data ?? []),
      supabase
        .from("tags")
        .select("id, name")
        .eq("wedding_id", wedding.id)
        .order("name")
        .then((r) => r.data ?? []),
      std
        ? fetchAll((f, t) =>
            supabase
              .from("save_the_date_sends")
              .select("id, household_id, method, method_override, status, token, to_address, error")
              .eq("save_the_date_id", std.id)
              .order("id")
              .range(f, t),
          )
        : Promise.resolve([]),
    ]);

  const guestTagMap = new Map<string, Set<string>>();
  for (const gt of guestTags) {
    const set = guestTagMap.get(gt.guest_id) ?? new Set();
    set.add(gt.tag_id);
    guestTagMap.set(gt.guest_id, set);
  }

  const guestEventMap = new Map<string, Set<string>>();
  for (const ge of eventInvites) {
    const set = guestEventMap.get(ge.guest_id) ?? new Set();
    set.add(ge.event_id);
    guestEventMap.set(ge.guest_id, set);
  }

  const declinedGuests = new Set<string>();
  const respondedGuests = new Set<string>();
  for (const r of rsvpResponses) {
    respondedGuests.add(r.guest_id);
    if (r.status === "declined") declinedGuests.add(r.guest_id);
  }

  const sendMap = new Map(sends.map((s) => [s.household_id, s]));

  const recipients: RecipientRow[] = [];
  for (const h of households) {
    const hGuests = guests.filter((g) => g.household_id === h.id);
    if (hGuests.length === 0) continue;

    const emails: string[] = [];
    const phones: string[] = [];
    const names: string[] = [];
    const tagIds = new Set<string>();
    const eventIds = new Set<string>();
    const sides = new Set<string>();
    let allDeclined = true;

    for (const g of hGuests) {
      names.push(`${g.first_name} ${g.last_name}`.trim());
      if (g.email) emails.push(g.email.trim().toLowerCase());
      if (g.phone) phones.push(g.phone.trim());
      sides.add(g.side);
      for (const tid of guestTagMap.get(g.id) ?? []) tagIds.add(tid);
      for (const eid of guestEventMap.get(g.id) ?? []) eventIds.add(eid);
      if (!respondedGuests.has(g.id) || !declinedGuests.has(g.id)) {
        allDeclined = false;
      }
    }
    if (hGuests.every((g) => respondedGuests.has(g.id) && declinedGuests.has(g.id))) {
      allDeclined = true;
    } else {
      allDeclined = false;
    }

    const send = sendMap.get(h.id);
    const uniqueEmails = [...new Set(emails)];
    const uniquePhones = [...new Set(phones)];

    let method: StdSendMethod | null = send?.method ?? null;
    if (!method && !send?.method_override) {
      if (uniqueEmails.length > 0) method = "email";
      else if (uniquePhones.length > 0) method = "sms";
    }

    recipients.push({
      householdId: h.id,
      householdName: h.name,
      country: h.country,
      language: h.preferred_language,
      guestNames: names,
      emails: uniqueEmails,
      phones: uniquePhones,
      side: sides.size === 1 ? [...sides][0] : "both",
      tags: [...tagIds],
      events: [...eventIds],
      declined: allDeclined,
      method,
      methodOverride: send?.method_override ?? false,
      status: send?.status ?? "not_sent",
      token: send?.token ?? null,
      sendId: send?.id ?? null,
      toAddress: send?.to_address ?? null,
      error: send?.error ?? null,
    });
  }

  const summary: RecipientSummary = {
    total: recipients.length,
    byEmail: recipients.filter((r) => r.method === "email").length,
    bySms: recipients.filter((r) => r.method === "sms").length,
    noContact: recipients.filter((r) => !r.method).length,
    alreadySent: recipients.filter((r) => r.status !== "not_sent").length,
    declined: recipients.filter((r) => r.declined).length,
  };

  return {
    ok: true,
    data: {
      recipients,
      summary,
      events,
      tags,
      stdId: std?.id ?? null,
    },
  };
}

export async function ensureRecipientSends(stdId: string): Promise<ActionResult<{ created: number }>> {
  const ctx = await editor();
  if (!ctx) return noPermission();
  const { wedding, supabase } = ctx;

  const households = await fetchAll((f, t) =>
    supabase
      .from("households")
      .select("id")
      .eq("wedding_id", wedding.id)
      .order("id")
      .range(f, t),
  );

  const existingSends = await fetchAll((f, t) =>
    supabase
      .from("save_the_date_sends")
      .select("household_id")
      .eq("save_the_date_id", stdId)
      .order("id")
      .range(f, t),
  );
  const existing = new Set(existingSends.map((s) => s.household_id));
  const missing = households.filter((h) => !existing.has(h.id));

  if (missing.length === 0) return { ok: true, data: { created: 0 } };

  for (let i = 0; i < missing.length; i += 500) {
    const batch = missing.slice(i, i + 500);
    const { error } = await supabase.from("save_the_date_sends").insert(
      batch.map((h) => ({
        wedding_id: wedding.id,
        save_the_date_id: stdId,
        household_id: h.id,
      })),
    );
    if (error) return fail("ensureRecipientSends", error);
  }

  revalidatePath("/app/save-the-date/recipients");
  return { ok: true, data: { created: missing.length } };
}

export async function updateSendMethod(
  sendId: string,
  method: StdSendMethod | null,
): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return noPermission();

  const { error } = await ctx.supabase
    .from("save_the_date_sends")
    .update({ method, method_override: true })
    .eq("id", sendId)
    .eq("wedding_id", ctx.wedding.id);

  if (error) return fail("updateSendMethod", error);
  return { ok: true };
}

export async function exportRecipientsCsv(): Promise<ActionResult<string>> {
  const result = await loadRecipients();
  if (!result.ok) return result;

  const rows = result.data.recipients;
  const header = "Household,Guests,Email,Phone,Side,Tags,Method,Status\n";
  const csv = rows
    .map((r) =>
      [
        csvEscape(r.householdName),
        csvEscape(r.guestNames.join("; ")),
        csvEscape(r.emails.join("; ")),
        csvEscape(r.phones.join("; ")),
        r.side,
        csvEscape(r.tags.join("; ")),
        r.method ?? "none",
        r.status,
      ].join(","),
    )
    .join("\n");

  return { ok: true, data: header + csv };
}

function csvEscape(s: string) {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
