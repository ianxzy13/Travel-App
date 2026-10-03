"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export type FareHint = {
  origin: string;
  destination: string;
  price_eur: number;
  airline: string | null;
  depart_month: string;
};

export async function getFareHints(
  origin: string,
  destination: string,
  departDate: string | null,
): Promise<FareHint[]> {
  const token = process.env.TRAVELPAYOUTS_API_TOKEN;
  if (!token || !origin || !destination) return [];

  const month = departDate ? departDate.slice(0, 7) : null;
  const admin = createAdminClient();
  if (!admin) return [];

  const cached = await loadCached(admin, origin, destination, month);
  if (cached.length > 0) return cached;

  const fresh = await fetchFromApi(token, origin, destination, month);
  if (fresh.length > 0) {
    await upsertCache(admin, fresh);
  }
  return fresh;
}

async function loadCached(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  origin: string,
  destination: string,
  month: string | null,
): Promise<FareHint[]> {
  let q = admin
    .from("fare_cache")
    .select("origin, destination, price_eur, airline, depart_month, fetched_at")
    .eq("origin", origin.toUpperCase())
    .eq("destination", destination.toUpperCase())
    .gt("fetched_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  if (month) q = q.eq("depart_month", month);
  const { data } = await q.order("price_eur", { ascending: true }).limit(3);
  return (data ?? []).map((r) => ({
    origin: r.origin,
    destination: r.destination,
    price_eur: Number(r.price_eur),
    airline: r.airline,
    depart_month: r.depart_month,
  }));
}

async function fetchFromApi(
  token: string,
  origin: string,
  destination: string,
  month: string | null,
): Promise<FareHint[]> {
  try {
    const params = new URLSearchParams({
      origin: origin.toUpperCase(),
      destination: destination.toUpperCase(),
      token,
      currency: "eur",
    });
    if (month) params.set("depart_date", month);
    const res = await fetch(
      `https://api.travelpayouts.com/aviasales/v3/prices_for_dates?${params}`,
      { next: { revalidate: 86400 } },
    );
    if (!res.ok) return [];
    const json = await res.json();
    if (!json.success || !Array.isArray(json.data)) return [];
    return json.data.slice(0, 3).map((d: Record<string, unknown>) => ({
      origin: String(d.origin ?? origin).toUpperCase(),
      destination: String(d.destination ?? destination).toUpperCase(),
      price_eur: Number(d.price ?? 0),
      airline: typeof d.airline === "string" ? d.airline : null,
      depart_month: String(d.departure_at ?? "").slice(0, 7) || month || "",
    }));
  } catch {
    return [];
  }
}

async function upsertCache(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  fares: FareHint[],
) {
  for (const f of fares) {
    await admin.from("fare_cache").upsert(
      {
        origin: f.origin,
        destination: f.destination,
        depart_month: f.depart_month,
        price_eur: f.price_eur,
        airline: f.airline,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: "origin,destination,depart_month" },
    );
  }
}
