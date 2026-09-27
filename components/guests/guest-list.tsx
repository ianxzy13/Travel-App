"use client";

import { Accessibility, ArrowDown, ArrowUp, ChevronsUpDown, Pencil, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { SortKey, SortState } from "@/lib/guests/filter";
import { AGE_GROUP_LABELS, sideLabel, type GuestView, type PartnerNames } from "@/lib/guests/model";
import { cn } from "@/lib/utils";
import { SideDot, TagBadge } from "./badges";
import type { EventOption, TagOption } from "./types";

export type GuestGroup = { id: string; name: string; guests: GuestView[] };

type Props = {
  /** one group per household when grouped, otherwise a single unnamed group */
  groups: GuestGroup[];
  grouped: boolean;
  selected: Set<string>;
  onSelect: (ids: string[], checked: boolean) => void;
  sort: SortState;
  onSort: (key: SortKey) => void;
  onEdit: (guest: GuestView) => void;
  onEditHousehold: (householdId: string) => void;
  guestNames: Map<string, string>;
  tags: Map<string, TagOption>;
  events: EventOption[];
  names: PartnerNames;
  canEdit: boolean;
};

/** Checkbox state for a set of ids: all, some ("indeterminate") or none selected. */
function checkState(ids: string[], selected: Set<string>) {
  const n = ids.filter((id) => selected.has(id)).length;
  return n === 0 ? false : n === ids.length ? true : ("indeterminate" as const);
}

export function GuestList(props: Props) {
  const { groups, selected, onSelect } = props;
  const allIds = groups.flatMap((g) => g.guests.map((x) => x.id));

  return (
    <>
      {/* ---------- Desktop / tablet: table ---------- */}
      <div className="bg-card hidden overflow-x-auto rounded-xl border md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground text-left text-xs">
            <tr>
              <th className="w-10 px-3 py-2">
                <Checkbox
                  checked={checkState(allIds, selected)}
                  onCheckedChange={(c) => onSelect(allIds, c === true)}
                  aria-label="Select all shown guests"
                />
              </th>
              <SortHeader label="Name" sortKey="name" {...props} />
              {!props.grouped && <SortHeader label="Household" sortKey="household" {...props} />}
              <SortHeader label="Side" sortKey="side" {...props} />
              <th className="px-3 py-2 font-medium">Events</th>
              <th className="px-3 py-2 font-medium">Tags</th>
              <th className="w-12 px-3 py-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          {groups.map((group) => (
            <tbody key={group.id} className="divide-y border-t">
              {props.grouped && (
                <tr className="bg-muted/30">
                  <td className="px-3 py-2">
                    <Checkbox
                      checked={checkState(
                        group.guests.map((g) => g.id),
                        selected,
                      )}
                      onCheckedChange={(c) =>
                        onSelect(
                          group.guests.map((g) => g.id),
                          c === true,
                        )
                      }
                      aria-label={`Select everyone in ${group.name}`}
                    />
                  </td>
                  <td colSpan={5} className="px-3 py-2">
                    <HouseholdHeader group={group} {...props} />
                  </td>
                </tr>
              )}
              {group.guests.map((g) => (
                <GuestRowDesktop key={g.id} guest={g} {...props} />
              ))}
            </tbody>
          ))}
        </table>
      </div>

      {/* ---------- Phone: cards ---------- */}
      <div className="space-y-4 md:hidden">
        {groups.map((group) => (
          <section key={group.id} aria-label={props.grouped ? group.name : "Guests"}>
            {props.grouped && (
              <div className="mb-2 flex items-center gap-3 px-1">
                <Checkbox
                  checked={checkState(
                    group.guests.map((g) => g.id),
                    selected,
                  )}
                  onCheckedChange={(c) =>
                    onSelect(
                      group.guests.map((g) => g.id),
                      c === true,
                    )
                  }
                  aria-label={`Select everyone in ${group.name}`}
                />
                <HouseholdHeader group={group} {...props} />
              </div>
            )}
            <ul className="bg-card divide-y rounded-xl border">
              {group.guests.map((g) => (
                <GuestCardMobile key={g.id} guest={g} {...props} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

function SortHeader({ label, sortKey, sort, onSort }: Props & { label: string; sortKey: SortKey }) {
  const active = sort.key === sortKey;
  const Icon = !active ? ChevronsUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      className="px-3 py-2 font-medium"
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1 rounded focus-visible:ring-2 focus-visible:outline-none"
      >
        {label}
        <Icon className={cn("size-3.5", !active && "opacity-40")} aria-hidden />
      </button>
    </th>
  );
}

function HouseholdHeader({ group, onEditHousehold, canEdit }: Props & { group: GuestGroup }) {
  return (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
      <span className="truncate font-medium">
        {group.name}{" "}
        <span className="text-muted-foreground font-normal">· {group.guests.length}</span>
      </span>
      {canEdit && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEditHousehold(group.id)}
          aria-label={`Edit household ${group.name}`}
        >
          <Pencil aria-hidden /> <span className="sr-only sm:not-sr-only">Edit household</span>
        </Button>
      )}
    </div>
  );
}

/** Name + little hints (plus-one, age, dietary, accessibility, B-list). */
function NameCell({ guest, onEdit, guestNames }: Props & { guest: GuestView }) {
  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={() => onEdit(guest)}
        className={cn(
          "focus-visible:ring-ring rounded text-left font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none",
          guest.plusOneOf && !guest.firstName && !guest.lastName && "text-muted-foreground italic",
        )}
      >
        {guest.name}
      </button>
      <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {guest.plusOneOf && <span>+1 of {guestNames.get(guest.plusOneOf) ?? "a guest"}</span>}
        {guest.ageGroup !== "adult" && <span>{AGE_GROUP_LABELS[guest.ageGroup]}</span>}
        {guest.list === "b" && (
          <span className="rounded bg-amber-100 px-1 font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            B-list
          </span>
        )}
        {guest.dietary && <Hint icon={Utensils} label={`Dietary: ${guest.dietary}`} />}
        {guest.accessibility && (
          <Hint icon={Accessibility} label={`Accessibility: ${guest.accessibility}`} />
        )}
      </div>
    </div>
  );
}

function Hint({ icon: Icon, label }: { icon: typeof Utensils; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} role="img" className="inline-flex" aria-label={label}>
          <Icon className="size-3.5" aria-hidden />
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** Invited events, each with a dot: green = coming, grey = not coming, hollow = no reply. */
function eventSummary(guest: GuestView, events: EventOption[]) {
  if (events.length === 0) return null;
  if (guest.eventIds.length === 0) return <span className="text-warning">Not invited</span>;
  return (
    <span className="inline-flex flex-wrap gap-x-2.5 gap-y-0.5">
      {events
        .filter((e) => guest.eventIds.includes(e.id))
        .map((e) => {
          const status = guest.rsvp[e.id];
          const label =
            status === "attending"
              ? "attending"
              : status === "declined"
                ? "not attending"
                : "no reply yet";
          return (
            <span
              key={e.id}
              className="inline-flex items-center gap-1 whitespace-nowrap"
              title={`${e.name}: ${label}`}
            >
              <span
                aria-hidden
                className={cn(
                  "inline-block size-2 rounded-full",
                  status === "attending" && "bg-success",
                  status === "declined" && "bg-foreground/30",
                  !status && "border-muted-foreground border",
                )}
              />
              <span className={cn(status === "declined" && "line-through")}>{e.name}</span>
              <span className="sr-only">({label})</span>
            </span>
          );
        })}
    </span>
  );
}

function TagList({ guest, tags }: { guest: GuestView; tags: Map<string, TagOption> }) {
  return (
    <div className="flex flex-wrap gap-1">
      {guest.tagIds.map((id) => {
        const t = tags.get(id);
        return t ? <TagBadge key={id} name={t.name} color={t.color} /> : null;
      })}
    </div>
  );
}

function GuestRowDesktop(props: Props & { guest: GuestView }) {
  const { guest, selected, onSelect, names, events, tags, grouped, onEdit, canEdit } = props;
  return (
    <tr className={cn("hover:bg-muted/30", selected.has(guest.id) && "bg-primary-soft/50")}>
      <td className="px-3 py-2.5 align-top">
        <Checkbox
          checked={selected.has(guest.id)}
          onCheckedChange={(c) => onSelect([guest.id], c === true)}
          aria-label={`Select ${guest.name}`}
        />
      </td>
      <td className={cn("px-3 py-2.5 align-top", grouped && guest.plusOneOf && "pl-8")}>
        <NameCell {...props} />
      </td>
      {!grouped && <td className="px-3 py-2.5 align-top">{guest.householdName}</td>}
      <td className="px-3 py-2.5 align-top whitespace-nowrap">
        <span className="inline-flex items-center gap-1.5">
          <SideDot side={guest.side} />
          {guest.side === "both" ? "Both" : guest.side === "partner_a" ? names.a : names.b}
        </span>
      </td>
      <td className="text-muted-foreground px-3 py-2.5 align-top">{eventSummary(guest, events)}</td>
      <td className="px-3 py-2.5 align-top">
        <TagList guest={guest} tags={tags} />
      </td>
      <td className="px-3 py-1.5 text-right align-top">
        {canEdit && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(guest)}
            aria-label={`Edit ${guest.name}`}
          >
            <Pencil aria-hidden />
          </Button>
        )}
      </td>
    </tr>
  );
}

function GuestCardMobile(props: Props & { guest: GuestView }) {
  const { guest, selected, onSelect, names, events, tags, grouped } = props;
  return (
    <li className={cn("flex gap-3 p-3", selected.has(guest.id) && "bg-primary-soft/50")}>
      <Checkbox
        className="mt-0.5"
        checked={selected.has(guest.id)}
        onCheckedChange={(c) => onSelect([guest.id], c === true)}
        aria-label={`Select ${guest.name}`}
      />
      <div className="min-w-0 flex-1 space-y-1.5">
        <NameCell {...props} />
        <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
          <span className="inline-flex items-center gap-1">
            <SideDot side={guest.side} />
            {sideLabel(guest.side, names)}
          </span>
          {!grouped && <span>· {guest.householdName}</span>}
          {events.length > 0 && <span>· {eventSummary(guest, events)}</span>}
        </p>
        {guest.tagIds.length > 0 && <TagList guest={guest} tags={tags} />}
      </div>
    </li>
  );
}
