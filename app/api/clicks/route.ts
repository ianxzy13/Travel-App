import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();
  const { wedding_id, guest_id, provider, url } = body ?? {};

  if (!wedding_id || !provider || !url) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("outbound_clicks").insert({
    wedding_id,
    guest_id: guest_id || null,
    provider,
    url,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
