"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  AlertTriangle,
  Check,
  CircleDashed,
  CloudOff,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  Printer,
  Redo2,
  SlidersHorizontal,
  Sparkles,
  Undo2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useSeatingWords } from "./use-seating-words";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { PartnerNames } from "@/lib/guests/model";
import { autoArrange } from "@/lib/seating/auto-arrange";
import { isTable, KINDS } from "@/lib/seating/geometry";
import { allIssues, analyzeSeating } from "@/lib/seating/rules";
import {
  addObject,
  assignSeat,
  assignToTable,
  createObject,
  deleteObject,
  duplicateObject,
  setRoom,
  unassign,
  updateObject,
} from "@/lib/seating/state";
import type {
  SeatingGuest,
  SeatingKind,
  SeatingRelationship,
  SeatingState,
} from "@/lib/seating/types";
import { cn } from "@/lib/utils";
import { FloorPlan, type FloorPlanApi } from "./floor-plan";
import { GuestPanel, type Picked } from "./guest-panel";
import { Inspector } from "./inspector";
import { ListView } from "./list-view";
import { legendItems, type ColorMode } from "./shapes";
import { useSeatingStore, type SaveStatus } from "./use-seating-store";

type Props = {
  layoutId: string;
  eventId: string;
  events: { id: string; name: string }[];
  initial: SeatingState;
  guests: SeatingGuest[];
  relationships: SeatingRelationship[];
  tags: { id: string; name: string }[];
  mealOptions: { id: string; name: string }[];
  names: PartnerNames;
  canEdit: boolean;
  /** capacity of the booked reception venue, if any */
  venue?: { name: string; capacity: number } | null;
  /** only for tests: replaces saving to the database */
  saveChanges?: Parameters<typeof useSeatingStore>[3];
};

const TABLE_KINDS: SeatingKind[] = ["round", "rect", "square", "head", "sweetheart"];
const DECOR_KINDS: SeatingKind[] = [
  "dance_floor",
  "stage",
  "bar",
  "buffet",
  "cake",
  "entrance",
  "pillar",
  "label",
];
const GRID = 50;

/** Prefer a seat under the pointer, then a table, then the guest list. */
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  const rank = (id: string) => (id.startsWith("seat:") ? 0 : id.startsWith("table:") ? 1 : 2);
  return hits.sort((a, b) => rank(String(a.id)) - rank(String(b.id)));
};

export function SeatingEditor(props: Props) {
  const { guests, relationships, canEdit, names } = props;
  const router = useRouter();
  const store = useSeatingStore(props.layoutId, props.initial, canEdit, props.saveChanges);
  const { t, words, tableName, issueText } = useSeatingWords();
  const { state, commit } = store;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedSeat, setSelectedSeat] = useState<{ objectId: string; seatIndex: number } | null>(
    null,
  );
  const [picked, setPicked] = useState<Picked>(null);
  const [colorMode, setColorMode] = useState<ColorMode>("side");
  const [snap, setSnap] = useState(true);
  const [view, setView] = useState<"plan" | "list">("plan");
  const [proposal, setProposal] = useState<{ placed: number; unplaced: number } | null>(null);
  const [dragLabel, setDragLabel] = useState<string | null>(null);
  const [guestSheet, setGuestSheet] = useState(false);
  const [detailSheet, setDetailSheet] = useState(false);
  const apiRef = useRef<FloorPlanApi | null>(null);

  const guestsById = useMemo(() => new Map(guests.map((g) => [g.id, g])), [guests]);
  const mealLookup = useMemo(
    () => new Map(props.mealOptions.map((m) => [m.id, m.name])),
    [props.mealOptions],
  );
  const mealIds = useMemo(() => props.mealOptions.map((m) => m.id), [props.mealOptions]);
  const analysis = useMemo(
    () => analyzeSeating(state, guestsById, relationships),
    [state, guestsById, relationships],
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const issues = useMemo(() => allIssues(state, analysis, words), [state, analysis]);

  const select = useCallback((id: string | null) => {
    setSelectedId(id);
    setSelectedSeat(null);
  }, []);

  // ---------- actions ----------

  function add(kind: SeatingKind) {
    const c = apiRef.current?.center() ?? { x: state.room.width / 2, y: state.room.height / 2 };
    const at = snap ? { x: Math.round(c.x / GRID) * GRID, y: Math.round(c.y / GRID) * GRID } : c;
    const obj = createObject(
      state,
      kind,
      at,
      crypto.randomUUID(),
      kind === "label" ? t("newLabel") : t(`kinds.${kind}`),
    );
    commit(addObject(state, obj));
    select(obj.id);
    setView("plan");
  }

  function reportUnplaced(unplaced: string[], table: string) {
    if (unplaced.length) {
      toast.warning(
        t("notFit", {
          count: unplaced.length,
          table,
          names: unplaced.map((id) => guestsById.get(id)?.name).join(", "),
        }),
      );
    }
  }

  /** Put guest(s) at a table (starting at a seat for groups). */
  function place(guestIds: string[], objectId: string, seatIndex?: number) {
    const t = state.objects[objectId];
    if (!t || !isTable(t.kind)) return;
    if (guestIds.length === 1 && seatIndex !== undefined) {
      commit(assignSeat(state, guestIds[0], objectId, seatIndex));
      return;
    }
    const r = assignToTable(state, guestIds, objectId, seatIndex);
    commit(r.state);
    reportUnplaced(r.unplaced, tableName(t));
  }

  function onSeatClick(objectId: string, seatIndex: number) {
    if (picked) {
      place(picked.guestIds, objectId, seatIndex);
      setPicked(null);
      return;
    }
    setSelectedId(null);
    setSelectedSeat({ objectId, seatIndex });
    const occupied = Object.values(state.assignments).some(
      (a) => a.objectId === objectId && a.seatIndex === seatIndex,
    );
    if (!occupied) {
      setSelectedSeat(null);
      setSelectedId(objectId);
    }
    setDetailSheet(true);
  }

  function onTableActivate(objectId: string) {
    if (!picked) return;
    place(picked.guestIds, objectId);
    setPicked(null);
  }

  function pick(p: Picked) {
    setPicked(p);
    if (p) {
      setGuestSheet(false);
      setDetailSheet(false);
    }
  }

  function runAutoArrange() {
    const candidates = guests.filter((g) => g.rsvp === "attending" && !state.assignments[g.id]);
    if (candidates.length === 0) {
      toast.info(t("allSeated"));
      return;
    }
    const r = autoArrange(state, candidates, guestsById, relationships);
    if (r.placed.length === 0) {
      toast.warning(t("noFreeSeats"));
      return;
    }
    commit(r.state);
    setProposal({ placed: r.placed.length, unplaced: r.unplaced.length });
  }

  // ---------- drag and drop (guests) ----------

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // touch: press and hold briefly, so normal scrolling still works
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  function guestIdsFor(activeId: string, data?: { guestIds?: string[] }) {
    if (data?.guestIds) return data.guestIds;
    if (activeId.startsWith("seat-guest:")) return [activeId.slice("seat-guest:".length)];
    return [];
  }

  function onDragStart(e: DragStartEvent) {
    const id = String(e.active.id);
    const data = e.active.data.current as { label?: string } | undefined;
    const guestId = id.startsWith("seat-guest:") ? id.slice(11) : null;
    setDragLabel(data?.label ?? (guestId ? (guestsById.get(guestId)?.name ?? "") : ""));
    setPicked(null);
  }

  function onDragEnd(e: DragEndEvent) {
    setDragLabel(null);
    const over = e.over ? String(e.over.id) : null;
    const ids = guestIdsFor(String(e.active.id), e.active.data.current as { guestIds?: string[] });
    if (!over || ids.length === 0) return;
    if (over === "panel") {
      const seated = ids.filter((id) => state.assignments[id]);
      if (seated.length) commit(unassign(state, seated));
      return;
    }
    const [kind, objectId, seat] = over.split(":");
    if (kind === "seat") place(ids, objectId, Number(seat));
    if (kind === "table") place(ids, objectId);
  }

  // ---------- keyboard shortcuts ----------

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest(
          "input, textarea, select, [contenteditable=true], [role=dialog], [role=listbox], [role=menu]",
        )
      )
        return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) store.redo();
        else store.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        store.redo();
        return;
      }
      if (e.key === "Escape") {
        setPicked(null);
        select(null);
        return;
      }
      const o = selectedId ? store.stateRef.current.objects[selectedId] : null;
      if (!o || !canEdit) return;
      const s = store.stateRef.current;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        commit(deleteObject(s, o.id));
        select(null);
        toast(t("deletedUndo"));
      } else if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        const id = crypto.randomUUID();
        commit(duplicateObject(s, o.id, id));
        select(id);
      } else if (e.key.toLowerCase() === "r" && !mod) {
        commit(
          updateObject(s, o.id, { rotation: (o.rotation + (e.shiftKey ? -15 : 15) + 360) % 360 }),
        );
      } else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        const step = e.shiftKey ? 50 : 10;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        commit(updateObject(s, o.id, { x: o.x + dx, y: o.y + dy }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, canEdit, commit, select, store]);

  // ---------- rendering ----------

  const selectedIssues = selectedId ? (analysis.byTable[selectedId] ?? []) : [];
  const { totals } = analysis;
  // More seats (or attending guests) than the booked venue holds?
  const venueOver =
    props.venue && Math.max(totals.seats, totals.attending) > props.venue.capacity
      ? t("venueOver", {
          venue: props.venue.name,
          capacity: props.venue.capacity,
          seats: totals.seats,
          attending: totals.attending,
        })
      : null;
  const warningCount = issues.length + (venueOver ? 1 : 0) + (totals.seatsShort > 0 ? 1 : 0);
  const legend = legendItems(colorMode, names, props.mealOptions, {
    sideOf: (name) => t("sideOf", { name }),
    both: t("legendBoth"),
    noMeal: t("legendNoMeal"),
  });

  const panel = (
    <GuestPanel
      guests={guests}
      state={state}
      names={names}
      tags={props.tags}
      mealLookup={mealLookup}
      canEdit={canEdit}
      picked={picked}
      onPick={pick}
    />
  );
  const inspector = (
    <Inspector
      state={state}
      selectedId={selectedId}
      selectedSeat={selectedSeat}
      guestsById={guestsById}
      mealLookup={mealLookup}
      issues={selectedIssues}
      canEdit={canEdit}
      snap={snap}
      onSnapChange={setSnap}
      onChange={(id, patch) => commit(updateObject(state, id, patch))}
      onRoomChange={(room) => commit(setRoom(state, room))}
      onDelete={(id) => {
        commit(deleteObject(state, id));
        select(null);
      }}
      onDuplicate={(id) => {
        const newId = crypto.randomUUID();
        commit(duplicateObject(state, id, newId));
        select(newId);
      }}
      onUnseat={(ids) => {
        commit(unassign(state, ids));
        setSelectedSeat(null);
      }}
      onMoveGuest={(g) => {
        pick({ guestIds: [g.id], label: g.name });
        toast.info(t("tapSeatFor", { name: g.name }));
      }}
    />
  );

  return (
    <DndContext
      // fixed id: keeps accessibility ids the same on server and browser (no hydration warning)
      id="seating-dnd"
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragLabel(null)}
    >
      <div className="flex h-[calc(100dvh-8.5rem)] min-h-[30rem] flex-col gap-3 md:h-[calc(100dvh-2rem)]">
        {/* ---------- header ---------- */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-3xl sm:text-4xl">{t("heading")}</h1>
          <Select
            value={props.eventId}
            onValueChange={(id) => router.push(`/app/seating?event=${id}`)}
          >
            <SelectTrigger size="sm" className="w-auto min-w-36" aria-label={t("event")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {props.events.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-sm">
            {t("totals", { tables: totals.tables, seats: totals.seats })}{" "}
            <span className={cn(totals.unseatedAttending > 0 && "text-foreground font-medium")}>
              {t("seatedOf", {
                seated: totals.attending - totals.unseatedAttending,
                attending: totals.attending,
              })}
            </span>
            {totals.seatsShort > 0 && (
              <span className="text-destructive font-medium">
                {t("seatsShort", { count: totals.seatsShort })}
              </span>
            )}
            {venueOver && (
              <span className="text-destructive font-medium">{t("overCapacity")}</span>
            )}
          </p>
          <SaveIndicator status={store.saveStatus} canEdit={canEdit} />
        </div>

        {/* ---------- toolbar ---------- */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="lg:hidden"
            onClick={() => setGuestSheet(true)}
          >
            <Users aria-hidden /> {t("guests")}
            {totals.unseatedAttending > 0 && (
              <span className="bg-primary text-primary-foreground rounded-full px-1.5 text-xs">
                {totals.unseatedAttending}
              </span>
            )}
          </Button>
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm">
                  <Plus aria-hidden /> {t("add")}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>{t("tables")}</DropdownMenuLabel>
                {TABLE_KINDS.map((k) => (
                  <DropdownMenuItem key={k} onSelect={() => add(k)}>
                    {t(`kinds.${k}`)}
                    <span className="text-muted-foreground ms-auto text-xs">
                      {t("seatsCount", { count: KINDS[k].defaultSeats })}
                    </span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>{t("room")}</DropdownMenuLabel>
                {DECOR_KINDS.map((k) => (
                  <DropdownMenuItem key={k} onSelect={() => add(k)}>
                    {t(`kinds.${k}`)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {canEdit && (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={store.undo}
                disabled={!store.canUndo}
                aria-label={t("undo")}
              >
                <Undo2 aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={store.redo}
                disabled={!store.canRedo}
                aria-label={t("redo")}
              >
                <Redo2 aria-hidden />
              </Button>
              <Button variant="outline" size="sm" onClick={runAutoArrange}>
                <Sparkles aria-hidden /> {t("autoArrange")}
              </Button>
            </>
          )}

          <div className="bg-muted flex rounded-lg p-0.5" role="radiogroup" aria-label={t("view")}>
            {(
              [
                ["plan", t("floorPlan"), LayoutGrid],
                ["list", t("list"), List],
              ] as const
            ).map(([v, label, Icon]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={view === v}
                onClick={() => setView(v)}
                className={cn(
                  "focus-visible:ring-ring flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm focus-visible:ring-2 focus-visible:outline-none",
                  view === v ? "bg-background shadow-sm" : "text-muted-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden />
                <span className="sr-only sm:not-sr-only">{label}</span>
              </button>
            ))}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <CircleDashed aria-hidden />{" "}
                <span className="sr-only sm:not-sr-only">{t("colourBy")}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuRadioGroup
                value={colorMode}
                onValueChange={(v) => setColorMode(v as ColorMode)}
              >
                <DropdownMenuRadioItem value="side">{t("side")}</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="meal">{t("meal")}</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="none">{t("oneColour")}</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(warningCount > 0 && "text-destructive")}
                aria-label={t("warningsCount", { count: warningCount })}
              >
                <AlertTriangle aria-hidden /> {warningCount}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80">
              <p className="mb-2 font-medium">{t("warnings")}</p>
              {issues.length === 0 && totals.seatsShort === 0 && !venueOver ? (
                <p className="text-muted-foreground text-sm">{t("allGood")}</p>
              ) : (
                <ul className="max-h-80 space-y-2 overflow-y-auto text-sm">
                  {venueOver && <li className="text-destructive">{venueOver}</li>}
                  {totals.seatsShort > 0 && (
                    <li className="text-destructive">
                      {t("shortSeats", { attending: totals.attending, seats: totals.seats })}
                    </li>
                  )}
                  {issues.map((i, n) => (
                    <li key={n}>
                      <button
                        type="button"
                        className="hover:bg-accent w-full rounded p-1 text-start"
                        onClick={() => {
                          select(i.tableId);
                          setView("plan");
                        }}
                      >
                        <span className="text-muted-foreground block text-xs">{i.tableName}</span>
                        {issueText(i)}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <Printer aria-hidden /> <span className="sr-only sm:not-sr-only">{t("print")}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(["plan", "tables", "alpha", "cards", "caterer"] as const).map((v) => (
                <DropdownMenuItem key={v} asChild>
                  <a
                    href={`/print/seating/${props.layoutId}?view=${v}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t(`printViews.${v}`)}
                  </a>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={() => setDetailSheet(true)}
          >
            <SlidersHorizontal aria-hidden /> {selectedId || selectedSeat ? t("details") : t("room")}
          </Button>
        </div>

        {proposal && (
          <div
            role="status"
            className="bg-primary-soft flex flex-wrap items-center gap-3 rounded-xl px-4 py-2 text-sm"
          >
            <Sparkles className="text-primary size-4" aria-hidden />
            <span className="flex-1">
              {t.rich("arranged", { count: proposal.placed, b: (c) => <strong>{c}</strong> })}{" "}
              {proposal.unplaced > 0 && t("arrangedMissing", { count: proposal.unplaced })}{" "}
              {t("checkResult")}
            </span>
            <Button size="sm" onClick={() => setProposal(null)}>
              <Check aria-hidden /> {t("keep")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                store.undo();
                setProposal(null);
              }}
            >
              <Undo2 aria-hidden /> {t("undoShort")}
            </Button>
          </div>
        )}

        {/* ---------- main area ---------- */}
        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[17rem_1fr_17rem]">
          <aside className="hidden min-h-0 lg:block" aria-label={t("guestsToSeat")}>
            {panel}
          </aside>
          <div className="min-h-0">
            {view === "plan" ? (
              <FloorPlan
                state={state}
                guestsById={guestsById}
                mealLookup={mealLookup}
                mealIds={mealIds}
                colorMode={colorMode}
                issuesByTable={analysis.byTable}
                selectedId={selectedId}
                selectedSeat={selectedSeat}
                picking={!!picked}
                canEdit={canEdit}
                snap={snap}
                grid={GRID}
                onSelect={(id) => {
                  select(id);
                  if (!id) setPicked(null);
                }}
                onSeatClick={onSeatClick}
                onTableActivate={onTableActivate}
                onPreview={store.preview}
                onCommit={commit}
                apiRef={apiRef}
              >
                {Object.keys(state.objects).length === 0 && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
                    <div className="bg-card/95 pointer-events-auto max-w-sm rounded-xl border p-6 text-center shadow-sm">
                      <p className="font-serif text-2xl">{t("emptyRoom")}</p>
                      <p className="text-muted-foreground mt-1 text-sm">
                        {canEdit ? t("emptyEditor") : t("emptyViewer")}
                      </p>
                      {canEdit && (
                        <Button className="mt-4" size="sm" onClick={() => add("round")}>
                          <Plus aria-hidden /> {t("addRound")}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
                {picked && (
                  <div
                    role="status"
                    className="bg-primary text-primary-foreground absolute top-3 left-1/2 flex max-w-[90%] -translate-x-1/2 items-center gap-2 rounded-full py-1.5 ps-4 pe-1.5 text-sm shadow-lg"
                  >
                    <span className="truncate">
                      {t.rich("tapFor", { name: picked.label, b: (c) => <strong>{c}</strong> })}
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 rounded-full"
                      onClick={() => setPicked(null)}
                    >
                      {t("cancel")}
                    </Button>
                  </div>
                )}
                {legend.length > 0 && (
                  <ul className="bg-card/95 absolute start-3 bottom-3 flex max-w-[60%] flex-wrap gap-x-3 gap-y-1 rounded-lg border px-3 py-1.5 text-xs shadow-sm">
                    {legend.map((l) => (
                      <li key={l.label} className="flex items-center gap-1.5">
                        <span
                          className="size-2.5 rounded-full"
                          style={{ background: l.color }}
                          aria-hidden
                        />
                        {l.label}
                      </li>
                    ))}
                  </ul>
                )}
              </FloorPlan>
            ) : (
              <ListView
                state={state}
                guests={guests}
                guestsById={guestsById}
                mealLookup={mealLookup}
                mealOptions={props.mealOptions}
                issuesByTable={analysis.byTable}
                canEdit={canEdit}
                onSeatAt={(guestId, tableId) => place([guestId], tableId)}
                onUnseat={(ids) => commit(unassign(state, ids))}
              />
            )}
          </div>
          <aside className="hidden min-h-0 lg:block" aria-label={t("selection")}>
            {inspector}
          </aside>
        </div>
      </div>

      {/* phones & tablets: panels open as sheets */}
      <Sheet open={guestSheet} onOpenChange={setGuestSheet}>
        <SheetContent side="left" className="w-[88vw] max-w-sm p-2">
          <SheetHeader className="sr-only">
            <SheetTitle>{t("guests")}</SheetTitle>
          </SheetHeader>
          {panel}
        </SheetContent>
      </Sheet>
      <Sheet open={detailSheet} onOpenChange={setDetailSheet}>
        <SheetContent side="bottom" className="max-h-[70dvh] p-2 lg:hidden">
          <SheetHeader className="sr-only">
            <SheetTitle>{t("details")}</SheetTitle>
          </SheetHeader>
          <div className="h-[60dvh]">{inspector}</div>
        </SheetContent>
      </Sheet>

      <DragOverlay dropAnimation={null}>
        {dragLabel && (
          <div className="bg-primary text-primary-foreground pointer-events-none rounded-full px-3 py-1.5 text-sm font-medium shadow-lg">
            {dragLabel}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function SaveIndicator({ status, canEdit }: { status: SaveStatus; canEdit: boolean }) {
  const { t } = useSeatingWords();
  if (!canEdit) return <span className="text-muted-foreground text-xs">{t("viewOnly")}</span>;
  const map = {
    saved: {
      icon: <Check className="size-3.5" aria-hidden />,
      text: t("saved"),
      cls: "text-muted-foreground",
    },
    saving: {
      icon: <Loader2 className="size-3.5 animate-spin" aria-hidden />,
      text: t("saving"),
      cls: "text-muted-foreground",
    },
    retrying: {
      icon: <CloudOff className="size-3.5" aria-hidden />,
      text: t("retrying"),
      cls: "text-warning",
    },
    error: {
      icon: <AlertTriangle className="size-3.5" aria-hidden />,
      text: t("notSaved"),
      cls: "text-destructive",
    },
  }[status];
  return (
    <span
      className={cn("ms-auto flex items-center gap-1 text-xs", map.cls)}
      role="status"
      aria-live="polite"
    >
      {map.icon} {map.text}
    </span>
  );
}
