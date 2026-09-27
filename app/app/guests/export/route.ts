import { format } from "date-fns";
import { getTranslations } from "next-intl/server";
import { localeInfo } from "@/i18n/locales";
import Papa from "papaparse";
import { safeCell } from "@/lib/guests/csv";
import { loadGuestData } from "@/lib/guests/load";
import { nameLabels } from "@/lib/guests/labels";
import { buildGuestViews, sideLabel } from "@/lib/guests/model";
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
  const g = await getTranslations("guests");
  const c = await getTranslations("guests.csv");

  const guests = buildGuestViews({ ...data, labels: await nameLabels() });
  const householdById = new Map(data.households.map((h) => [h.id, h]));
  const eventName = new Map(data.events.map((e) => [e.id, e.name]));
  const tagName = new Map(data.tags.map((t) => [t.id, t.name]));
  const guestName = new Map(guests.map((g) => [g.id, g.name]));

  // Households together, plus-ones right after their host.
  const rows = groupByHousehold(guests).flatMap((group) =>
    group.guests.map((guest) => {
      const h = householdById.get(guest.householdId);
      // column names in the person's language; the importer recognises them
      return {
        [c("firstName")]: guest.firstName,
        [c("lastName")]: guest.lastName,
        [c("household")]: guest.householdName,
        [c("side")]: sideLabel(guest.side, names, g),
        [c("ageGroup")]: g(`ageGroups.${guest.ageGroup}`),
        [c("list")]: guest.list === "b" ? "B" : "A",
        [c("plusOneOf")]: guest.plusOneOf ? (guestName.get(guest.plusOneOf) ?? "") : "",
        [c("plusOneAllowed")]: guest.plusOneAllowed ? c("yes") : c("no"),
        [c("email")]: guest.email,
        [c("phone")]: guest.phone,
        [c("line1")]: h?.address_line1,
        [c("line2")]: h?.address_line2,
        [c("city")]: h?.city,
        [c("state")]: h?.region,
        [c("postalCode")]: h?.postal_code,
        [c("country")]: h?.country,
        [c("events")]: guest.eventIds.map((id) => eventName.get(id)).join(", "),
        [c("tags")]: guest.tagIds.map((id) => tagName.get(id)).join(", "),
        [c("dietary")]: guest.dietary,
        [c("accessibility")]: guest.accessibility,
        [c("notes")]: guest.notes,
        [c("language")]: guest.householdLanguage ? localeInfo(guest.householdLanguage).english : "",
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
  const filename = `${c("file")}-${slug || "wedding"}-${format(new Date(), "yyyy-MM-dd")}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
