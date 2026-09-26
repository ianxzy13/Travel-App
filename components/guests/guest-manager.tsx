"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Plus, Tags, Upload, Users } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_FILTERS,
  filterGuests,
  groupByHousehold,
  sortGuests,
  type GuestFilters,
  type SortKey,
  type SortState,
} from "@/lib/guests/filter";
import { computeStats } from "@/lib/guests/stats";
import { SendEmailDialog } from "@/components/rsvp-admin/send-email-dialog";
import { BulkBar } from "./bulk-bar";
import { GuestList, type GuestGroup } from "./guest-list";
import { GuestSheet, type SheetMode } from "./guest-sheet";
import { GuestStatsBar } from "./guest-stats";
import { GuestToolbar } from "./guest-toolbar";
import { HouseholdDialog } from "./household-dialog";
import { TagsDialog } from "./tags-dialog";
import type { GuestPageData } from "./types";

/** The whole /app/guests screen. Filtering and sorting happen in the browser. */
export function GuestManager(data: GuestPageData) {
  const { guests, households, events, tags, names, canEdit, emailConfigured } = data;

  const [filters, setFilters] = useState<GuestFilters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortState>({ key: "name", dir: "asc" });
  const [grouped, setGrouped] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sheet, setSheet] = useState<SheetMode>(null);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);

  const tagsById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);
  const guestNames = useMemo(() => new Map(guests.map((g) => [g.id, g.name])), [guests]);
  const tagUsage = useMemo(() => {
    const usage = new Map<string, number>();
    for (const g of guests) for (const t of g.tagIds) usage.set(t, (usage.get(t) ?? 0) + 1);
    return usage;
  }, [guests]);

  // Counters follow only the A/B list switch, not the other filters.
  const stats = useMemo(
    () =>
      computeStats(filters.list === "all" ? guests : guests.filter((g) => g.list === filters.list)),
    [guests, filters.list],
  );

  const visible = useMemo(
    () => sortGuests(filterGuests(guests, filters), sort),
    [guests, filters, sort],
  );
  const groups: GuestGroup[] = useMemo(
    () => (grouped ? groupByHousehold(visible) : [{ id: "all", name: "", guests: visible }]),
    [grouped, visible],
  );

  // Forget selected guests that were deleted or filtered out.
  const visibleIds = new Set(visible.map((g) => g.id));
  const selectedIds = [...selected].filter((id) => visibleIds.has(id));

  function select(ids: string[], checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function toggleSort(key: SortKey) {
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  const actions = (
    <>
      {canEdit && (
        <Button asChild variant="outline" size="sm">
          <Link href="/app/guests/import">
            <Upload aria-hidden /> Import
          </Link>
        </Button>
      )}
      {guests.length > 0 && (
        <Button asChild variant="outline" size="sm">
          {/* a normal link: the browser downloads the CSV file */}
          <a href="/app/guests/export" download>
            <Download aria-hidden /> Export
          </a>
        </Button>
      )}
      {canEdit && (
        <Button variant="outline" size="sm" onClick={() => setTagsOpen(true)}>
          <Tags aria-hidden /> Tags
        </Button>
      )}
      {canEdit && (
        <Button size="sm" onClick={() => setSheet({ kind: "new" })}>
          <Plus aria-hidden /> Add guest
        </Button>
      )}
    </>
  );

  return (
    <>
      <PageHeader
        title="Guests"
        description="Everyone you're inviting, grouped into households."
        actions={actions}
      />

      {guests.length === 0 ? (
        <div className="bg-card flex flex-col items-center rounded-2xl border border-dashed px-6 py-16 text-center">
          <span className="bg-primary-soft text-primary mb-4 inline-flex size-14 items-center justify-center rounded-full">
            <Users className="size-7" aria-hidden />
          </span>
          <h2 className="text-3xl">No guests yet</h2>
          <p className="text-muted-foreground mt-2 max-w-sm">
            {canEdit
              ? "Add your first one, or import the spreadsheet you've already started."
              : "Once the couple adds guests, they'll appear here."}
          </p>
          {canEdit && (
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button onClick={() => setSheet({ kind: "new" })}>
                <Plus aria-hidden /> Add a guest
              </Button>
              <Button asChild variant="outline">
                <Link href="/app/guests/import">
                  <Upload aria-hidden /> Import a spreadsheet
                </Link>
              </Button>
            </div>
          )}
        </div>
      ) : (
        // extra bottom space so the floating bulk bar never hides the last rows
        <div className={canEdit && selectedIds.length > 0 ? "space-y-6 pb-24" : "space-y-6"}>
          <GuestStatsBar stats={stats} events={events} names={names} />
          <GuestToolbar
            filters={filters}
            onChange={setFilters}
            grouped={grouped}
            onGroupedChange={setGrouped}
            events={events}
            tags={tags}
            households={households}
            names={names}
            resultCount={visible.length}
          />

          {visible.length === 0 ? (
            <div className="rounded-xl border border-dashed p-10 text-center">
              <p className="text-muted-foreground">No guests match your search and filters.</p>
              <Button variant="link" onClick={() => setFilters(DEFAULT_FILTERS)}>
                Clear search and filters
              </Button>
            </div>
          ) : (
            <GuestList
              groups={groups}
              grouped={grouped}
              selected={selected}
              onSelect={select}
              sort={sort}
              onSort={toggleSort}
              onEdit={(guest) => canEdit && setSheet({ kind: "edit", guest })}
              onEditHousehold={setHouseholdId}
              guestNames={guestNames}
              tags={tagsById}
              events={events}
              names={names}
              canEdit={canEdit}
            />
          )}
          <p className="text-muted-foreground text-center text-sm">
            Showing {visible.length} of {guests.length} guests
          </p>
        </div>
      )}

      {canEdit && selectedIds.length > 0 && (
        <BulkBar
          ids={selectedIds}
          onClear={() => setSelected(new Set())}
          onEmail={() => setEmailOpen(true)}
          events={events}
          tags={tags}
          names={names}
        />
      )}

      <GuestSheet mode={sheet} onModeChange={setSheet} {...data} />
      <SendEmailDialog
        open={emailOpen}
        onOpenChange={setEmailOpen}
        emailConfigured={emailConfigured}
        households={emailTargets(guests, selectedIds)}
        onSent={() => setSelected(new Set())}
      />
      <TagsDialog open={tagsOpen} onOpenChange={setTagsOpen} tags={tags} usage={tagUsage} />
      <HouseholdDialog
        household={households.find((h) => h.id === householdId) ?? null}
        onClose={() => setHouseholdId(null)}
      />
    </>
  );
}

/** The households of the selected guests (emails go out per household). */
function emailTargets(guests: GuestPageData["guests"], selectedIds: string[]) {
  const chosen = new Set(
    guests.filter((g) => selectedIds.includes(g.id)).map((g) => g.householdId),
  );
  const targets = new Map<string, { id: string; name: string; hasEmail: boolean }>();
  for (const g of guests) {
    if (!chosen.has(g.householdId)) continue;
    const t = targets.get(g.householdId) ?? {
      id: g.householdId,
      name: g.householdName,
      hasEmail: false,
    };
    if (g.email && !g.plusOneOf) t.hasEmail = true;
    targets.set(g.householdId, t);
  }
  return [...targets.values()];
}
