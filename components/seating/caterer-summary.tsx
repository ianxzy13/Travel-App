import { Utensils } from "lucide-react";
import { isTable, tableName } from "@/lib/seating/geometry";
import type { SeatingGuest, SeatingObject, SeatingState } from "@/lib/seating/types";

// No "use client": used by the editor and by the server-rendered print pages.

export function sortedTables(state: SeatingState) {
  return Object.values(state.objects)
    .filter((o) => isTable(o.kind))
    .sort(
      (a, b) => (a.number ?? 9999) - (b.number ?? 9999) || tableName(a).localeCompare(tableName(b)),
    );
}

/** Guests at a table, in seat order. */
export function guestsAtTable(
  state: SeatingState,
  guestsById: Map<string, SeatingGuest>,
  t: SeatingObject,
) {
  return Object.values(state.assignments)
    .filter((a) => a.objectId === t.id)
    .sort((a, b) => a.seatIndex - b.seatIndex)
    .map((a) => guestsById.get(a.guestId))
    .filter((g): g is SeatingGuest => !!g);
}

/** Meals per table, for the caterer. */
export function CatererSummary({
  tables,
  mealOptions,
  guestsAt,
}: {
  state: SeatingState;
  tables: SeatingObject[];
  mealOptions: { id: string; name: string }[];
  guestsAt: (t: SeatingObject) => SeatingGuest[];
}) {
  const totals = new Map<string, number>();
  const rows = tables.map((t) => {
    const counts = new Map<string, number>();
    let dietary = 0;
    for (const g of guestsAt(t)) {
      const key = g.mealOptionId ?? "none";
      counts.set(key, (counts.get(key) ?? 0) + 1);
      totals.set(key, (totals.get(key) ?? 0) + 1);
      if (g.dietary) dietary++;
    }
    return { t, counts, dietary };
  });
  const cols = [...mealOptions, { id: "none", name: "Not chosen" }];

  return (
    <section className="bg-card overflow-x-auto rounded-xl border p-4">
      <h3 className="mb-3 flex items-center gap-2 text-2xl">
        <Utensils className="text-primary size-5" aria-hidden /> Meals per table
      </h3>
      <table className="w-full text-sm">
        <thead className="text-muted-foreground text-left text-xs">
          <tr>
            <th className="py-1 pr-3 font-medium">Table</th>
            {cols.map((c) => (
              <th key={c.id} className="px-2 py-1 text-right font-medium">
                {c.name}
              </th>
            ))}
            <th className="px-2 py-1 text-right font-medium">Special diets</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map(({ t, counts, dietary }) => (
            <tr key={t.id}>
              <td className="py-1.5 pr-3">{tableName(t)}</td>
              {cols.map((c) => (
                <td key={c.id} className="px-2 text-right tabular-nums">
                  {counts.get(c.id) || ""}
                </td>
              ))}
              <td className="px-2 text-right tabular-nums">{dietary || ""}</td>
            </tr>
          ))}
          <tr className="font-medium">
            <td className="py-1.5 pr-3">Total</td>
            {cols.map((c) => (
              <td key={c.id} className="px-2 text-right tabular-nums">
                {totals.get(c.id) ?? 0}
              </td>
            ))}
            <td className="px-2 text-right tabular-nums">
              {rows.reduce((n, r) => n + r.dietary, 0)}
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
