"use client";

import { useMemo, useState } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Accessibility, GripVertical, Search, Utensils, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { normalize } from "@/lib/guests/filter";
import type { PartnerNames } from "@/lib/guests/model";
import { tableName } from "@/lib/seating/geometry";
import type { SeatingGuest, SeatingState } from "@/lib/seating/types";
import { cn } from "@/lib/utils";

export type Picked = { guestIds: string[]; label: string } | null;

type Props = {
  guests: SeatingGuest[];
  state: SeatingState;
  names: PartnerNames;
  tags: { id: string; name: string }[];
  mealLookup: Map<string, string>;
  canEdit: boolean;
  picked: Picked;
  onPick: (p: Picked) => void;
};

/**
 * Guests to seat, grouped by household. Drag a person or a whole household
 * onto the plan, or tap to pick them and then tap a seat. Dropping a seated
 * guest back here removes them from their seat.
 */
export function GuestPanel({
  guests,
  state,
  names,
  tags,
  mealLookup,
  canEdit,
  picked,
  onPick,
}: Props) {
  const [search, setSearch] = useState("");
  const [attendingOnly, setAttendingOnly] = useState(true);
  const [unseatedOnly, setUnseatedOnly] = useState(true);
  const [side, setSide] = useState("all");
  const [tag, setTag] = useState("all");
  const { setNodeRef, isOver } = useDroppable({ id: "panel", disabled: !canEdit });

  const attending = guests.filter((g) => g.rsvp === "attending");
  const seatedAttending = attending.filter((g) => state.assignments[g.id]).length;

  const groups = useMemo(() => {
    const words = normalize(search).split(/\s+/).filter(Boolean);
    const visible = guests.filter((g) => {
      if (attendingOnly && g.rsvp !== "attending") return false;
      if (unseatedOnly && state.assignments[g.id]) return false;
      if (side !== "all" && g.side !== side) return false;
      if (tag !== "all" && !g.tagIds.includes(tag)) return false;
      if (words.length) {
        const hay = normalize(`${g.name} ${g.householdName}`);
        if (!words.every((w) => hay.includes(w))) return false;
      }
      return true;
    });
    const map = new Map<string, { id: string; name: string; guests: SeatingGuest[] }>();
    for (const g of visible) {
      const group = map.get(g.householdId) ?? {
        id: g.householdId,
        name: g.householdName,
        guests: [],
      };
      group.guests.push(g);
      map.set(g.householdId, group);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [guests, attendingOnly, unseatedOnly, side, tag, search, state.assignments]);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "bg-card flex h-full min-h-0 flex-col rounded-xl border transition-colors",
        isOver && "border-primary bg-primary-soft/40",
      )}
    >
      <div className="space-y-3 border-b p-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-2xl">Guests</h2>
          <p className="text-muted-foreground text-xs" aria-live="polite">
            {seatedAttending} of {attending.length} attending seated
          </p>
        </div>
        <div className="relative">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search guests…"
            aria-label="Search guests"
            className="h-8 pl-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Select value={side} onValueChange={setSide}>
            <SelectTrigger size="sm" className="w-full" aria-label="Filter by side">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Both sides</SelectItem>
              <SelectItem value="partner_a">{names.a}&apos;s side</SelectItem>
              <SelectItem value="partner_b">{names.b}&apos;s side</SelectItem>
              <SelectItem value="both">Shared</SelectItem>
            </SelectContent>
          </Select>
          <Select value={tag} onValueChange={setTag}>
            <SelectTrigger size="sm" className="w-full" aria-label="Filter by tag">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tags</SelectItem>
              {tags.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
          <Label className="text-xs font-normal">
            <Switch checked={unseatedOnly} onCheckedChange={setUnseatedOnly} /> Not seated only
          </Label>
          <Label className="text-xs font-normal">
            <Switch checked={!attendingOnly} onCheckedChange={(v) => setAttendingOnly(!v)} />{" "}
            Include not replied
          </Label>
        </div>
        {picked && (
          <div
            role="status"
            className="bg-primary-soft flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
          >
            <span className="flex-1">
              Tap a seat or table for <strong>{picked.label}</strong>
            </span>
            <button
              type="button"
              onClick={() => onPick(null)}
              aria-label="Cancel"
              className="hover:bg-background rounded p-0.5"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {groups.length === 0 ? (
          <p className="text-muted-foreground p-4 text-center text-sm">
            {attending.length === 0
              ? "Nobody has RSVP'd yes to this event yet. Switch on “Include not replied” to plan ahead."
              : unseatedOnly
                ? "Everyone matching is seated. 🎉"
                : "No guests match."}
          </p>
        ) : (
          <ul className="space-y-2">
            {groups.map((h) => (
              <HouseholdGroup
                key={h.id}
                id={h.id}
                name={h.name}
                guests={h.guests}
                state={state}
                mealLookup={mealLookup}
                canEdit={canEdit}
                picked={picked}
                onPick={onPick}
              />
            ))}
          </ul>
        )}
      </div>
      {canEdit && (
        <p className="text-muted-foreground border-t px-3 py-2 text-[0.7rem]">
          Drag onto a seat or table, or tap a name then tap a seat. Drag a seated guest here to
          unseat.
        </p>
      )}
    </div>
  );
}

function HouseholdGroup({
  id,
  name,
  guests,
  state,
  mealLookup,
  canEdit,
  picked,
  onPick,
}: {
  id: string;
  name: string;
  guests: SeatingGuest[];
  state: SeatingState;
  mealLookup: Map<string, string>;
  canEdit: boolean;
  picked: Picked;
  onPick: (p: Picked) => void;
}) {
  const unseated = guests.filter((g) => !state.assignments[g.id]).map((g) => g.id);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `household:${id}`,
    data: { guestIds: unseated.length ? unseated : guests.map((g) => g.id), label: name },
    disabled: !canEdit || guests.length < 2,
  });
  const ids = unseated.length ? unseated : guests.map((g) => g.id);
  const pickLabel = `${name} (${ids.length})`;
  const isPicked = picked?.label === pickLabel;

  return (
    <li className={cn("rounded-lg border", isDragging && "opacity-40")}>
      {guests.length > 1 && (
        <div
          ref={setNodeRef}
          {...listeners}
          {...attributes}
          onClick={() => canEdit && onPick(isPicked ? null : { guestIds: ids, label: pickLabel })}
          aria-label={`${name}, ${guests.length} guests. Drag or tap to seat together`}
          className={cn(
            "bg-muted/50 flex cursor-grab items-center gap-1.5 rounded-t-lg px-2 py-1.5 text-xs font-medium",
            isPicked && "bg-primary text-primary-foreground",
          )}
        >
          <GripVertical className="size-3.5 opacity-50" aria-hidden />
          <span className="flex-1 truncate">{name}</span>
          <span className="opacity-70">{guests.length}</span>
        </div>
      )}
      <ul>
        {guests.map((g) => (
          <GuestRow
            key={g.id}
            guest={g}
            seatLabel={seatLabel(state, g.id)}
            meal={g.mealOptionId ? mealLookup.get(g.mealOptionId) : undefined}
            canEdit={canEdit}
            picked={picked?.guestIds.length === 1 && picked.guestIds[0] === g.id}
            onPick={onPick}
          />
        ))}
      </ul>
    </li>
  );
}

function seatLabel(state: SeatingState, guestId: string) {
  const a = state.assignments[guestId];
  const t = a && state.objects[a.objectId];
  return t ? tableName(t) : null;
}

function GuestRow({
  guest: g,
  seatLabel,
  meal,
  canEdit,
  picked,
  onPick,
}: {
  guest: SeatingGuest;
  seatLabel: string | null;
  meal?: string;
  canEdit: boolean;
  picked: boolean;
  onPick: (p: Picked) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `guest:${g.id}`,
    data: { guestIds: [g.id], label: g.name },
    disabled: !canEdit,
  });

  // The drag handle (role="button") sits inside the <li>, so the list stays a proper list.
  return (
    <li className="last:*:rounded-b-lg">
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        onClick={() => canEdit && onPick(picked ? null : { guestIds: [g.id], label: g.name })}
        aria-label={`${g.name}${seatLabel ? `, seated at ${seatLabel}` : ", not seated"}. Drag or tap to seat`}
        className={cn(
          "flex cursor-grab items-center gap-2 px-2 py-1.5 text-sm",
          picked ? "bg-primary text-primary-foreground" : "hover:bg-accent",
          isDragging && "opacity-40",
        )}
      >
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate", !g.firstName && !g.lastName && "italic")}>
            {g.name}
          </span>
          {(meal || g.rsvp !== "attending") && (
            <span
              className={cn(
                "block truncate text-xs",
                picked ? "opacity-80" : "text-muted-foreground",
              )}
            >
              {g.rsvp === "declined" ? "Declined" : g.rsvp === null ? "No reply yet" : meal}
            </span>
          )}
        </span>
        {g.dietary && (
          <Utensils
            className="size-3.5 shrink-0 opacity-60"
            role="img"
            aria-label={`Dietary: ${g.dietary}`}
          />
        )}
        {g.accessibility && (
          <Accessibility
            className="size-3.5 shrink-0 opacity-60"
            role="img"
            aria-label={`Accessibility: ${g.accessibility}`}
          />
        )}
        {seatLabel && (
          <span
            className={cn(
              "shrink-0 rounded px-1.5 text-xs",
              picked ? "bg-primary-foreground/20" : "bg-muted",
            )}
          >
            {seatLabel}
          </span>
        )}
      </div>
    </li>
  );
}
