import { NextResponse } from "next/server";
import { retentionCutoff, warningCutoff, RETENTION_MONTHS } from "@/lib/privacy/retention";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "No admin client" }, { status: 500 });
  }

  const cutoff = retentionCutoff();
  const warnCutoff = warningCutoff();
  let anonymised = 0;
  let warned = 0;

  // 1. Anonymise weddings past the retention period
  const { data: expired } = await admin
    .from("weddings")
    .select("id")
    .lte("wedding_date", cutoff)
    .is("anonymised_at", null)
    .not("wedding_date", "is", null);

  for (const w of expired ?? []) {
    await admin.rpc("anonymise_wedding_guests", { p_wedding_id: w.id });
    anonymised++;
  }

  // 2. Warn couples approaching the retention cutoff (30 days before)
  const { data: upcoming } = await admin
    .from("weddings")
    .select("id, partner_a_name, partner_b_name")
    .gt("wedding_date", cutoff)
    .lte("wedding_date", warnCutoff)
    .is("anonymised_at", null)
    .not("wedding_date", "is", null);

  for (const w of upcoming ?? []) {
    const { data: members } = await admin
      .from("wedding_members")
      .select("user_id")
      .eq("wedding_id", w.id)
      .in("role", ["owner", "editor"]);

    const alreadyWarned = await admin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("wedding_id", w.id)
      .eq("type", "system")
      .like("title", "%data will be anonymised%");

    if ((alreadyWarned.count ?? 0) > 0) continue;

    for (const m of members ?? []) {
      await admin.from("notifications").insert({
        wedding_id: w.id,
        user_id: m.user_id,
        type: "system",
        title: `Guest data will be anonymised in ${RETENTION_MONTHS} months`,
        body: `Guest personal data for ${w.partner_a_name} & ${w.partner_b_name} will be automatically anonymised ${RETENTION_MONTHS} months after your wedding date. Download any data you need before then.`,
        link: "/app/guests",
      });
    }
    warned++;
  }

  return NextResponse.json({ anonymised, warned });
}
