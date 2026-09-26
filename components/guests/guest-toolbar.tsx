"use client";

import { ListFilter, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { activeFilterCount, DEFAULT_FILTERS, type GuestFilters } from "@/lib/guests/filter";
import { AGE_GROUP_LABELS, type PartnerNames } from "@/lib/guests/model";
import { cn } from "@/lib/utils";
import type { EventOption, HouseholdOption, TagOption } from "./types";

type Props = {
  filters: GuestFilters;
  onChange: (f: GuestFilters) => void;
  grouped: boolean;
  onGroupedChange: (g: boolean) => void;
  events: EventOption[];
  tags: TagOption[];
  households: HouseholdOption[];
  names: PartnerNames;
  resultCount: number;
};

const LISTS = [
  { value: "all", label: "Everyone" },
  { value: "a", label: "A-list" },
  { value: "b", label: "B-list" },
] as const;

export function GuestToolbar(props: Props) {
  const { filters, onChange, grouped, onGroupedChange } = props;
  const set = <K extends keyof GuestFilters>(key: K, value: GuestFilters[K]) =>
    onChange({ ...filters, [key]: value });
  const count = activeFilterCount({ ...filters, list: "all" });

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="relative flex-1">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          type="search"
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          placeholder="Search names, households, emails…"
          aria-label="Search guests"
          className="pl-9"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* A-list / B-list toggle */}
        <div role="radiogroup" aria-label="Which list" className="bg-muted flex rounded-lg p-0.5">
          {LISTS.map((l) => (
            <button
              key={l.value}
              type="button"
              role="radio"
              aria-checked={filters.list === l.value}
              onClick={() => set("list", l.value)}
              className={cn(
                "focus-visible:ring-ring rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none",
                filters.list === l.value
                  ? "bg-background font-medium shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {l.label}
            </button>
          ))}
        </div>

        <FilterPopover {...props} count={count} set={set} />

        <label className="flex items-center gap-2 text-sm">
          <Switch checked={grouped} onCheckedChange={onGroupedChange} />
          Group by household
        </label>
      </div>
    </div>
  );
}

function FilterPopover({
  filters,
  onChange,
  events,
  tags,
  households,
  names,
  resultCount,
  count,
  set,
}: Props & {
  count: number;
  set: <K extends keyof GuestFilters>(key: K, value: GuestFilters[K]) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9">
          <ListFilter aria-hidden />
          Filters
          {count > 0 && (
            <span className="bg-primary text-primary-foreground rounded-full px-1.5 text-xs">
              {count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-4">
        <FilterSelect
          id="f-side"
          label="Side"
          value={filters.side}
          onChange={(v) => set("side", v as GuestFilters["side"])}
          options={[
            { value: "partner_a", label: `${names.a}'s side` },
            { value: "partner_b", label: `${names.b}'s side` },
            { value: "both", label: "Both" },
          ]}
        />
        <FilterSelect
          id="f-event"
          label="Event"
          value={filters.eventId}
          onChange={(v) => set("eventId", v)}
          options={[
            ...events.map((e) => ({ value: e.id, label: `Invited to ${e.name}` })),
            { value: "none", label: "Not invited to anything" },
          ]}
        />
        <FilterSelect
          id="f-tag"
          label="Tag"
          value={filters.tagId}
          onChange={(v) => set("tagId", v)}
          options={tags.map((t) => ({ value: t.id, label: t.name }))}
        />
        <FilterSelect
          id="f-household"
          label="Household"
          value={filters.householdId}
          onChange={(v) => set("householdId", v)}
          options={[...households]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((h) => ({ value: h.id, label: h.name }))}
        />
        <FilterSelect
          id="f-age"
          label="Age group"
          value={filters.ageGroup}
          onChange={(v) => set("ageGroup", v as GuestFilters["ageGroup"])}
          options={Object.entries(AGE_GROUP_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <FilterSelect
          id="f-rsvp"
          label="RSVP"
          value={filters.rsvp}
          onChange={(v) => set("rsvp", v as GuestFilters["rsvp"])}
          options={[
            { value: "attending", label: "Attending" },
            { value: "declined", label: "Not attending" },
            { value: "waiting", label: "No reply yet" },
          ]}
        />
        <div className="flex items-center justify-between border-t pt-3 text-sm">
          <span className="text-muted-foreground">{resultCount} matching</span>
          <Button
            variant="ghost"
            size="sm"
            disabled={count === 0}
            onClick={() =>
              onChange({ ...DEFAULT_FILTERS, search: filters.search, list: filters.list })
            }
          >
            <X aria-hidden /> Clear filters
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
