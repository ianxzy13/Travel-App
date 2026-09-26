"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { normalize } from "@/lib/guests/filter";

export type PickerGuest = { id: string; name: string; householdId: string; householdName: string; note?: string };

/** Searchable list of guests with checkboxes, grouped by household. */
export function GuestPicker({
  guests,
  selected,
  onChange,
  maxHeight = "18rem",
}: {
  guests: PickerGuest[];
  selected: string[];
  onChange: (ids: string[]) => void;
  maxHeight?: string;
}) {
  const [search, setSearch] = useState("");
  const chosen = new Set(selected);

  const groups = useMemo(() => {
    const words = normalize(search).split(/\s+/).filter(Boolean);
    const map = new Map<string, { id: string; name: string; guests: PickerGuest[] }>();
    for (const g of guests) {
      const hay = normalize(`${g.name} ${g.householdName}`);
      if (!words.every((w) => hay.includes(w)) && !chosen.has(g.id)) continue;
      const group = map.get(g.householdId) ?? { id: g.householdId, name: g.householdName, guests: [] };
      group.guests.push(g);
      map.set(g.householdId, group);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guests, search]);

  function set(ids: string[], on: boolean) {
    const next = new Set(chosen);
    for (const id of ids) {
      if (on) next.add(id);
      else next.delete(id);
    }
    onChange([...next]);
  }

  return (
    <div className="rounded-lg border">
      <div className="relative border-b p-2">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2" aria-hidden />
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search guests…"
          aria-label="Search guests"
          className="h-8 pl-8"
        />
      </div>
      <div className="overflow-y-auto p-1" style={{ maxHeight }}>
        {groups.length === 0 ? (
          <p className="text-muted-foreground p-3 text-center text-sm">No guests match.</p>
        ) : (
          groups.map((h) => {
            const ids = h.guests.map((g) => g.id);
            const n = ids.filter((id) => chosen.has(id)).length;
            return (
              <div key={h.id} className="py-1">
                <label className="text-muted-foreground flex items-center gap-2 px-2 py-1 text-xs font-medium">
                  <Checkbox
                    checked={n === 0 ? false : n === ids.length ? true : "indeterminate"}
                    onCheckedChange={(c) => set(ids, c === true)}
                    aria-label={`Select everyone in ${h.name}`}
                  />
                  {h.name}
                </label>
                {h.guests.map((g) => (
                  <label key={g.id} className="hover:bg-accent flex items-center gap-2 rounded px-2 py-1 pl-7 text-sm">
                    <Checkbox checked={chosen.has(g.id)} onCheckedChange={(c) => set([g.id], c === true)} />
                    <span className="flex-1 truncate">{g.name}</span>
                    {g.note && <span className="text-muted-foreground shrink-0 text-xs">{g.note}</span>}
                  </label>
                ))}
              </div>
            );
          })
        )}
      </div>
      <p className="text-muted-foreground border-t px-3 py-1.5 text-xs" aria-live="polite">
        {selected.length} selected
      </p>
    </div>
  );
}
