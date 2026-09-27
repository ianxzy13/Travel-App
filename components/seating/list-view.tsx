"use client";

import { AlertTriangle, UserMinus } from "lucide-react";
import { CatererSummary, sortedTables } from "./caterer-summary";
import { useSeatingWords } from "./use-seating-words";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TableIssue } from "@/lib/seating/rules";
import { freeSeats } from "@/lib/seating/state";
import type { SeatingGuest, SeatingObject, SeatingState } from "@/lib/seating/types";

/** Table-by-table list: easier than the floor plan on a phone. */
export function ListView({
  state,
  guests,
  guestsById,
  mealLookup,
  mealOptions,
  issuesByTable,
  canEdit,
  onSeatAt,
  onUnseat,
}: {
  state: SeatingState;
  guests: SeatingGuest[];
  guestsById: Map<string, SeatingGuest>;
  mealLookup: Map<string, string>;
  mealOptions: { id: string; name: string }[];
  issuesByTable: Record<string, TableIssue[]>;
  canEdit: boolean;
  onSeatAt: (guestId: string, tableId: string) => void;
  onUnseat: (guestIds: string[]) => void;
}) {
  const tables = sortedTables(state);
  const { t, tableName, issueText } = useSeatingWords();
  const unseated = guests.filter((g) => g.rsvp === "attending" && !state.assignments[g.id]);

  const guestsAt = (t: SeatingObject) =>
    Object.values(state.assignments)
      .filter((a) => a.objectId === t.id)
      .sort((a, b) => a.seatIndex - b.seatIndex)
      .map((a) => guestsById.get(a.guestId))
      .filter((g): g is SeatingGuest => !!g);

  const tablePicker = (g: SeatingGuest, current?: string) =>
    canEdit && (
      <Select value={current ?? ""} onValueChange={(v) => onSeatAt(g.id, v)}>
        <SelectTrigger size="sm" className="w-32" aria-label={t("listView.seatAt", { name: g.name })}>
          <SelectValue placeholder={t("listView.seatAtPlaceholder")} />
        </SelectTrigger>
        <SelectContent>
          {tables.map((table) => {
            const full = freeSeats(state, table.id).length === 0 && table.id !== current;
            return (
              <SelectItem key={table.id} value={table.id} disabled={full}>
                {tableName(table)} {full ? t("listView.full") : ""}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    );

  return (
    <div className="space-y-6 overflow-y-auto pb-6">
      {unseated.length > 0 && (
        <section className="bg-card rounded-xl border p-4">
          <h3 className="mb-2 font-sans text-sm font-medium">
            {t("listView.unseated", { count: unseated.length })}
          </h3>
          <ul className="divide-y">
            {unseated.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-1.5 text-sm">
                <span className="min-w-32 flex-1 truncate">
                  {g.name} <span className="text-muted-foreground">· {g.householdName}</span>
                </span>
                {tablePicker(g)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {tables.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center">{t("listView.noTables")}</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(19rem,1fr))] gap-4">
          {tables.map((table) => {
            const people = guestsAt(table);
            const issues = issuesByTable[table.id] ?? [];
            return (
              <section key={table.id} className="bg-card rounded-xl border p-4">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <h3 className="text-2xl">{tableName(table)}</h3>
                  <span className="text-muted-foreground text-sm tabular-nums">
                    {people.length}/{table.seatCount}
                  </span>
                </div>
                {issues.map((i, n) => (
                  <p key={n} className="text-destructive mb-1 flex gap-1.5 text-xs">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {issueText(i)}
                  </p>
                ))}
                {people.length === 0 ? (
                  <p className="text-muted-foreground text-sm">{t("listView.empty")}</p>
                ) : (
                  <ul className="divide-y">
                    {people.map((g) => (
                      <li
                        key={g.id}
                        className="flex flex-wrap items-center gap-x-2 gap-y-1 py-1.5 text-sm"
                      >
                        <span className="min-w-32 flex-1">
                          <span className="block truncate">{g.name}</span>
                          <span className="text-muted-foreground block truncate text-xs">
                            {[g.mealOptionId && mealLookup.get(g.mealOptionId), g.dietary]
                              .filter(Boolean)
                              .join(" · ") || " "}
                          </span>
                        </span>
                        {tablePicker(g, table.id)}
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => onUnseat([g.id])}
                            aria-label={t("listView.unseat", { name: g.name })}
                          >
                            <UserMinus aria-hidden />
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      {tables.length > 0 && mealOptions.length > 0 && (
        <CatererSummary
          state={state}
          guestsAt={guestsAt}
          tables={tables}
          mealOptions={mealOptions}
        />
      )}
    </div>
  );
}
