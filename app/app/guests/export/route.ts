import { format } from "date-fns";
import Papa from "papaparse";
import { safeCell } from "@/lib/guests/csv";
import { loadGuestData } from "@/lib/guests/load";
import { AGE_GROUP_LABELS, buildGuestViews, sideLabel } from "@/lib/guests/model";
import { groupByHousehold } from "@/lib/guests/filter";
import { createClient } from "@/lib/supabase/server";
import { requireWedding } from "@/lib/wedding";

/**
 * GET /app/guests/export → downloads the guest list as a CSV file.
 * Column names match the importer, so the file can be edited and re-imported.
 */
export async function GET() {
  const { wedding } = await requireWedding();
  const data = await loadGuestData(await createClient(), wedding.id);
  const names = { a: wedding.partner_a_name, b: wedding.partner_b_name };

  const guests = buildGuestViews(data);
  const householdById = new Map(data.households.map((h) => [h.id, h]));
  const eventName = new Map(data.events.map((e) => [e.id, e.name]));
  const tagName = new Map(data.tags.map((t) => [t.id, t.name]));
  const guestName = new Map(guests.map((g) => [g.id, g.name]));

  // Households together, plus-ones right after their host.
  const rows = groupByHousehold(guests).flatMap((group) =>
    group.guests.map((g) => {
      const h = householdById.get(g.householdId);
      return {
        "First name": g.firstName,
        "Last name": g.lastName,
        Household: g.householdName,
        Side: sideLabel(g.side, names),
        "Age group": AGE_GROUP_LABELS[g.ageGroup],
        List: g.list === "b" ? "B" : "A",
        "Plus-one of": g.plusOneOf ? (guestName.get(g.plusOneOf) ?? "") : "",
        "Plus-one allowed": g.plusOneAllowed ? "Yes" : "No",
        Email: g.email,
        Phone: g.phone,
        "Address line 1": h?.address_line1,
        "Address line 2": h?.address_line2,
        City: h?.city,
        State: h?.region,
        "Postal code": h?.postal_code,
        Country: h?.country,
        Events: g.eventIds.map((id) => eventName.get(id)).join(", "),
        Tags: g.tagIds.map((id) => tagName.get(id)).join(", "),
        Dietary: g.dietary,
        Accessibility: g.accessibility,
        Notes: g.notes,
      };
    }),
  );

  const safeRows = rows.map((r) =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k, safeCell(v ?? "")])),
  );
  // The "﻿" byte-order mark makes Excel read accents (é, ñ…) correctly.
  const csv = "﻿" + Papa.unparse(safeRows, { newline: "\r\n" });

  const slug = `${wedding.partner_a_name}-${wedding.partner_b_name}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const filename = `guests-${slug || "wedding"}-${format(new Date(), "yyyy-MM-dd")}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
