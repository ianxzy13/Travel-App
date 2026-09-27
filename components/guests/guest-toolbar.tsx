"use client";

import { ListFilter, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
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
import { Flag } from "@/components/flag";
import { localeInfo } from "@/i18n/locales";
import { activeFilterCount, DEFAULT_FILTERS, type GuestFilters } from "@/lib/guests/filter";
import { AGE_GROUPS, type PartnerNames } from "@/lib/guests/model";
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
  /** languages the households speak */
  languages: string[];
  resultCount: number;
};

export function GuestToolbar(props: Props) {
  const { filters, onChange, grouped, onGroupedChange } = props;
  const t = useTranslations("guests.toolbar");
  const set = <K extends keyof GuestFilters>(key: K, value: GuestFilters[K]) =>
    onChange({ ...filters, [key]: value });
  const count = activeFilterCount({ ...filters, list: "all" });
  const lists = [
    { value: "all", label: t("everyone") },
    { value: "a", label: t("aList") },
    { value: "b", label: t("bList") },
  ] as const;

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="relative flex-1">
        <Search
          className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          type="search"
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          placeholder={t("search")}
          aria-label={t("searchLabel")}
          className="ps-9"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* A-list / B-list toggle */}
        <div role="radiogroup" aria-label={t("whichList")} className="bg-muted flex rounded-lg p-0.5">
          {lists.map((l) => (
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
          {t("group")}
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
  languages,
  resultCount,
  count,
  set,
}: Props & {
  count: number;
  set: <K extends keyof GuestFilters>(key: K, value: GuestFilters[K]) => void;
}) {
  const t = useTranslations("guests.toolbar");
  const g = useTranslations("guests");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9">
          <ListFilter aria-hidden />
          {t("filters")}
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
          label={t("side")}
          value={filters.side}
          onChange={(v) => set("side", v as GuestFilters["side"])}
          options={[
            { value: "partner_a", label: g("sideOf", { name: names.a }) },
            { value: "partner_b", label: g("sideOf", { name: names.b }) },
            { value: "both", label: g("both") },
          ]}
        />
        <FilterSelect
          id="f-event"
          label={t("event")}
          value={filters.eventId}
          onChange={(v) => set("eventId", v)}
          options={[
            ...events.map((e) => ({ value: e.id, label: t("invitedTo", { name: e.name }) })),
            { value: "none", label: t("notInvited") },
          ]}
        />
        <FilterSelect
          id="f-tag"
          label={t("tag")}
          value={filters.tagId}
          onChange={(v) => set("tagId", v)}
          options={tags.map((tag) => ({ value: tag.id, label: tag.name }))}
        />
        <FilterSelect
          id="f-household"
          label={t("household")}
          value={filters.householdId}
          onChange={(v) => set("householdId", v)}
          options={[...households]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((h) => ({ value: h.id, label: h.name }))}
        />
        {languages.length > 1 && (
          <FilterSelect
            id="f-language"
            label={t("language")}
            value={filters.language}
            onChange={(v) => set("language", v)}
            options={languages.map((code) => ({
              value: code,
              label: (
                <span className="inline-flex items-center gap-2">
                  <Flag locale={code} /> {localeInfo(code).native}
                </span>
              ),
            }))}
          />
        )}
        <FilterSelect
          id="f-age"
          label={t("age")}
          value={filters.ageGroup}
          onChange={(v) => set("ageGroup", v as GuestFilters["ageGroup"])}
          options={AGE_GROUPS.map((value) => ({ value, label: g(`ageGroups.${value}`) }))}
        />
        <FilterSelect
          id="f-rsvp"
          label={t("rsvp")}
          value={filters.rsvp}
          onChange={(v) => set("rsvp", v as GuestFilters["rsvp"])}
          options={[
            { value: "attending", label: t("attending") },
            { value: "declined", label: t("declined") },
            { value: "waiting", label: t("waiting") },
          ]}
        />
        <div className="flex items-center justify-between border-t pt-3 text-sm">
          <span className="text-muted-foreground">{t("matching", { count: resultCount })}</span>
          <Button
            variant="ghost"
            size="sm"
            disabled={count === 0}
            onClick={() =>
              onChange({ ...DEFAULT_FILTERS, search: filters.search, list: filters.list })
            }
          >
            <X aria-hidden /> {t("clear")}
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
  options: { value: string; label: React.ReactNode }[];
}) {
  const t = useTranslations("guests.toolbar");
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("any")}</SelectItem>
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
