"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  AlertTriangle,
  ArrowLeftRight,
  Baby,
  BedDouble,
  Download,
  Loader2,
  Lock,
  MessageCircle,
  MoreVertical,
  Pencil,
  Plus,
  Printer,
  Search,
  Sparkles,
  User,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  addRoomsQuick,
  assignGuestToRoom,
  autoArrangeRoomAssignments,
  swapRoomGuests,
  unassignGuestFromRoom,
  updateRoomDetails,
} from "@/app/app/hotels/room-actions";
import { MoneyInput } from "@/components/budget/money-input";
import type { PickerGuest } from "@/components/guests/guest-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatMoney } from "@/lib/budget/money";
import type {
  BedConfig,
  BedKind,
  HotelRoomAssignmentRow,
  HotelRoomRow,
  HotelRoomTypeRow,
  TagColor,
} from "@/lib/database.types";
import { autoArrangeRooms } from "@/lib/hotels/auto-arrange-rooms";
import { computeRoomCosts } from "@/lib/hotels/room-costs";
import { checkRoomRules, type RoomWarning, type WarningKind } from "@/lib/hotels/room-rules";
import {
  bedSpots,
  matchesRsvpFilter,
  roomCapacity,
  roomTitle,
  type FriendGroup,
  type RsvpFilter,
  type RsvpStatus,
} from "@/lib/hotels/room-sharing";
import { cn } from "@/lib/utils";

type RoomTypeItem = Omit<HotelRoomTypeRow, "price_per_night"> & {
  price_per_night: number | null;
};

export type BoardGuest = PickerGuest & {
  ageGroup: string;
  accessibility: string | null;
  rsvpStatus: RsvpStatus;
  roomPrefShare: string | null;
  roomPrefAvoid: string | null;
  group: FriendGroup;
};

type Relationship = {
  guestA: string;
  guestB: string;
  type: "keep_together" | "keep_apart";
};

type Hotel = { id: string; name: string; price_per_night: number | null };

type Props = {
  hotels: Hotel[];
  roomTypes: RoomTypeItem[];
  rooms: HotelRoomRow[];
  roomAssignments: HotelRoomAssignmentRow[];
  guests: BoardGuest[];
  relationships: Relationship[];
  currency: string;
  canEdit: boolean;
};

const BED_ICONS: Record<BedKind, string> = {
  double: "🛏️",
  single: "🛏️",
  sofa_bed: "🛋️",
  bunk: "🪜",
};
const BED_KINDS: BedKind[] = ["double", "single", "sofa_bed", "bunk"];

const DOT_CLASS: Record<TagColor, string> = {
  stone: "bg-muted-foreground",
  rose: "bg-tint-blush-fg",
  sage: "bg-tint-sage-fg",
  sky: "bg-tint-mist-fg",
  amber: "bg-tint-sand-fg",
  violet: "bg-tint-mauve-fg",
};
const DOT_COLORS = Object.keys(DOT_CLASS) as TagColor[];

/** Households have no colour of their own, so pick a stable one from their id. */
function groupColor(group: FriendGroup): TagColor {
  if (group.color) return group.color;
  let h = 0;
  for (const ch of group.key) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return DOT_COLORS[Math.abs(h) % DOT_COLORS.length];
}

function GroupDot({ group }: { group: FriendGroup }) {
  return (
    <span
      title={group.label}
      aria-label={group.label}
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        DOT_CLASS[groupColor(group)],
        !group.color && "opacity-60",
      )}
    />
  );
}

const HIDDEN_BY_DEFAULT: WarningKind[] = ["stranger_pair", "no_room", "empty_room"];

export function RoomBoard({
  hotels,
  roomTypes,
  rooms,
  roomAssignments,
  guests,
  relationships,
  currency,
  canEdit,
}: Props) {
  const t = useTranslations("hotels");
  const [pending, startTransition] = useTransition();
  const [dragging, setDragging] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [hotelFilter, setHotelFilter] = useState<string>("all");
  const [rsvpFilter, setRsvpFilter] = useState<RsvpFilter>("planning");
  const [showFilter, setShowFilter] = useState<"all" | "unassigned" | "kids" | "accessible">(
    "all",
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [mixedHints, setMixedHints] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [swap, setSwap] = useState<{ guestId: string; roomId: string } | null>(null);
  const lastDrag = useRef(0);

  // Mouse only: on phones you tap a guest, then tap a room.
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 5 } }));

  const typeMap = useMemo(() => new Map(roomTypes.map((rt) => [rt.id, rt])), [roomTypes]);
  const guestMap = useMemo(() => new Map(guests.map((g) => [g.id, g])), [guests]);
  const hotelName = useMemo(() => new Map(hotels.map((h) => [h.id, h.name])), [hotels]);

  const assignmentsByRoom = useMemo(() => {
    const map = new Map<string, HotelRoomAssignmentRow[]>();
    for (const a of roomAssignments) map.set(a.room_id, [...(map.get(a.room_id) ?? []), a]);
    return map;
  }, [roomAssignments]);

  const roomOf = useMemo(
    () => new Map(roomAssignments.map((a) => [a.guest_id, a.room_id])),
    [roomAssignments],
  );

  const capacityOf = useCallback(
    (room: HotelRoomRow) =>
      roomCapacity(room, room.room_type_id ? typeMap.get(room.room_type_id) : null),
    [typeMap],
  );

  const warnings = useMemo(() => {
    const ruleGuests = new Map(
      guests.map((g) => [
        g.id,
        {
          id: g.id,
          name: g.name,
          householdId: g.householdId,
          ageGroup: g.ageGroup,
          accessibility: g.accessibility,
        },
      ]),
    );
    return checkRoomRules({
      rooms,
      roomTypes: new Map(roomTypes.map((rt) => [rt.id, rt as unknown as HotelRoomTypeRow])),
      assignments: roomAssignments,
      guests: ruleGuests,
      relationships,
      attendingGuestIds: new Set(guests.filter((g) => g.rsvpStatus === "attending").map((g) => g.id)),
      declinedGuestIds: new Set(guests.filter((g) => g.rsvpStatus === "declined").map((g) => g.id)),
    });
  }, [rooms, roomTypes, roomAssignments, guests, relationships]);

  const warningsByRoom = useMemo(() => {
    const map = new Map<string, RoomWarning[]>();
    for (const w of warnings) {
      if (!w.roomId || w.kind === "empty_room") continue;
      if (w.kind === "stranger_pair" && !mixedHints) continue;
      map.set(w.roomId, [...(map.get(w.roomId) ?? []), w]);
    }
    return map;
  }, [warnings, mixedHints]);

  const problemCount = warnings.filter((w) => !HIDDEN_BY_DEFAULT.includes(w.kind)).length;

  const costs = useMemo(
    () =>
      computeRoomCosts({
        hotels,
        rooms,
        roomTypes: new Map(roomTypes.map((rt) => [rt.id, rt])),
        assignments: roomAssignments,
      }),
    [hotels, rooms, roomTypes, roomAssignments],
  );

  const visibleRooms = useMemo(
    () => (hotelFilter === "all" ? rooms : rooms.filter((r) => r.hotel_id === hotelFilter)),
    [rooms, hotelFilter],
  );

  const visibleGuests = useMemo(() => {
    const q = search.trim().toLowerCase();
    return guests.filter((g) => {
      if (!matchesRsvpFilter(g.rsvpStatus, rsvpFilter)) return false;
      if (showFilter === "unassigned" && roomOf.has(g.id)) return false;
      if (showFilter === "kids" && g.ageGroup !== "child" && g.ageGroup !== "infant") return false;
      if (showFilter === "accessible" && !g.accessibility) return false;
      if (q && !`${g.name} ${g.householdName} ${g.group.label}`.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [guests, rsvpFilter, showFilter, search, roomOf]);

  const unplacedCount = guests.filter(
    (g) => g.rsvpStatus !== "declined" && !roomOf.has(g.id),
  ).length;

  const run = useCallback(
    (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) =>
      startTransition(async () => {
        const r = await fn();
        if (r.ok) toast.success(success);
        else toast.error(r.error);
      }),
    [],
  );

  /** Put a guest in a room; if it's full, offer a swap instead. */
  const place = useCallback(
    (guestId: string, roomId: string) => {
      if (!canEdit || roomOf.get(guestId) === roomId) return;
      const room = rooms.find((r) => r.id === roomId);
      if (!room) return;
      if ((assignmentsByRoom.get(roomId)?.length ?? 0) >= capacityOf(room)) {
        setSwap({ guestId, roomId });
        return;
      }
      run(
        () =>
          assignGuestToRoom({ roomId, guestId, checkIn: "", checkOut: "", needsCrib: false }),
        t("board.assigned"),
      );
    },
    [canEdit, rooms, roomOf, assignmentsByRoom, capacityOf, run, t],
  );

  const unplace = useCallback(
    (guestId: string) => run(() => unassignGuestFromRoom(guestId), t("board.removed")),
    [run, t],
  );

  const onDragStart = (e: DragStartEvent) => {
    setDragging(String(e.active.id));
    setSelected(null);
  };

  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    lastDrag.current = Date.now();
    const guestId = String(e.active.id);
    const over = e.over?.id ? String(e.over.id) : null;
    if (!over || !canEdit) return;
    if (over === "unassigned-zone") {
      if (roomOf.has(guestId)) unplace(guestId);
      return;
    }
    place(guestId, over.replace("room-", ""));
  };

  const tapGuest = (id: string) => {
    if (!canEdit || Date.now() - lastDrag.current < 300) return;
    setSelected((prev) => (prev === id ? null : id));
  };

  const tapRoom = (roomId: string) => {
    if (!selected) return;
    place(selected, roomId);
    setSelected(null);
  };

  const autoArrange = () =>
    startTransition(async () => {
      const result = autoArrangeRooms({
        rooms,
        roomTypes: new Map(roomTypes.map((rt) => [rt.id, rt as unknown as HotelRoomTypeRow])),
        existingAssignments: roomAssignments,
        guests: guests
          .filter((g) => g.rsvpStatus === "attending")
          .map((g) => ({
            id: g.id,
            name: g.name,
            householdId: g.householdId,
            ageGroup: g.ageGroup,
            accessibility: g.accessibility,
          })),
        relationships,
      });
      if (!result.assignments.length) {
        toast(t("board.noRoomsAvailable"));
        return;
      }
      const r = await autoArrangeRoomAssignments(result.assignments);
      if (r.ok) {
        toast.success(
          t("board.arranged", { placed: result.placed.length, unplaced: result.unplaced.length }),
        );
      } else toast.error(r.error);
    });

  const roomOptions = visibleRooms.map((r) => ({
    id: r.id,
    title: roomTitle(r),
    hotel: hotels.length > 1 ? hotelName.get(r.hotel_id) : undefined,
    free: capacityOf(r) - (assignmentsByRoom.get(r.id)?.length ?? 0),
  }));

  const addDialog = (
    <AddRoomsDialog
      open={addOpen}
      onOpenChange={setAddOpen}
      hotels={hotels}
      defaultHotel={hotelFilter !== "all" ? hotelFilter : hotels[0]?.id}
      currency={currency}
    />
  );

  if (rooms.length === 0) {
    return (
      <>
        <EmptyState hasHotels={hotels.length > 0} canEdit={canEdit} onAdd={() => setAddOpen(true)} />
        {addDialog}
      </>
    );
  }

  const draggingGuest = dragging ? guestMap.get(dragging) : null;
  const swapRoom = swap ? rooms.find((r) => r.id === swap.roomId) : null;
  const swapGuest = swap ? guestMap.get(swap.guestId) : null;
  const swapFrom = swap ? rooms.find((r) => r.id === roomOf.get(swap.guestId)) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
        {/* Guests: a top section on phones, a sidebar on desktop */}
        <div className="bg-card flex max-h-[45vh] w-full shrink-0 flex-col gap-3 overflow-hidden rounded-xl border p-3 md:max-h-none md:w-72">
          <div className="flex items-baseline justify-between">
            <h2 className="font-serif text-2xl">{t("board.guests")}</h2>
            <span className="text-muted-foreground text-xs" aria-live="polite">
              {t("board.unassigned", { count: unplacedCount })}
            </span>
          </div>

          <div className="relative">
            <Search className="text-muted-foreground absolute start-2 top-2 size-4" aria-hidden />
            <Input
              className="h-8 ps-8"
              placeholder={t("board.search")}
              aria-label={t("board.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Select value={rsvpFilter} onValueChange={(v) => setRsvpFilter(v as RsvpFilter)}>
            <SelectTrigger className="h-8 w-full text-xs" aria-label={t("board.rsvpFilter")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="planning">{t("board.filter.planning")}</SelectItem>
              <SelectItem value="attending">{t("board.filter.attending")}</SelectItem>
              <SelectItem value="not_replied">{t("board.filter.notReplied")}</SelectItem>
              <SelectItem value="everyone">{t("board.filter.everyone")}</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex flex-wrap gap-1">
            {(["all", "unassigned", "kids", "accessible"] as const).map((f) => (
              <Button
                key={f}
                variant={showFilter === f ? "secondary" : "ghost"}
                size="sm"
                className="h-6 px-2 text-xs"
                aria-pressed={showFilter === f}
                onClick={() => setShowFilter(f)}
              >
                {t(`board.filter.${f}`)}
              </Button>
            ))}
          </div>

          {canEdit && <UnassignedZone />}

          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {visibleGuests.map((g) => (
              <SidebarGuest
                key={g.id}
                guest={g}
                roomTitle={(() => {
                  const r = rooms.find((x) => x.id === roomOf.get(g.id));
                  return r ? roomTitle(r) : null;
                })()}
                selected={selected === g.id}
                canEdit={canEdit}
                onTap={tapGuest}
              />
            ))}
            {visibleGuests.length === 0 && (
              <p className="text-muted-foreground py-4 text-center text-xs">{t("board.noGuests")}</p>
            )}
          </ul>
        </div>

        {/* Rooms */}
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {hotels.length > 1 && (
              <Select value={hotelFilter} onValueChange={setHotelFilter}>
                <SelectTrigger className="h-8 w-48" aria-label={t("board.allHotels")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("board.allHotels")}</SelectItem>
                  {hotels.map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      {h.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <span className="text-muted-foreground text-sm">
              {t("board.roomCount", { count: visibleRooms.length })}
            </span>
            {canEdit && (
              <Button size="sm" variant="outline" className="h-8" onClick={() => setAddOpen(true)}>
                <Plus aria-hidden /> {t("board.add.button")}
              </Button>
            )}
            {canEdit && unplacedCount > 0 && (
              <Button size="sm" variant="outline" className="h-8" disabled={pending} onClick={autoArrange}>
                {pending ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <Sparkles aria-hidden />
                )}
                {t("board.autoArrange")}
              </Button>
            )}
            <div className="ms-auto flex flex-wrap items-center gap-2">
              <Label className="text-muted-foreground gap-2 text-xs font-normal">
                <Switch checked={mixedHints} onCheckedChange={setMixedHints} />
                {t("board.mixedHints")}
              </Label>
              {problemCount > 0 && (
                <span className="text-warning flex items-center gap-1 text-sm">
                  <AlertTriangle className="size-4" aria-hidden />
                  {t("board.warnings", { count: problemCount })}
                </span>
              )}
              <Button size="sm" variant="outline" className="h-8" asChild>
                <a href="/app/hotels/rooms/export" download>
                  <Download aria-hidden /> {t("export.csv")}
                </a>
              </Button>
              <Button size="sm" variant="outline" className="h-8" asChild>
                <Link href="/print/rooms" target="_blank">
                  <Printer aria-hidden /> {t("export.pdf")}
                </Link>
              </Button>
            </div>
          </div>

          {selected && (
            <div
              role="status"
              className="bg-primary-soft sticky top-0 z-10 flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
            >
              <span className="flex-1">
                {t("board.tapRoom", { name: guestMap.get(selected)?.name ?? "" })}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                aria-label={t("board.cancelPick")}
                onClick={() => setSelected(null)}
              >
                <X className="size-4" aria-hidden />
              </Button>
            </div>
          )}

          <div className="grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] content-start gap-3 md:overflow-y-auto">
            {visibleRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                roomType={room.room_type_id ? typeMap.get(room.room_type_id) : undefined}
                capacity={capacityOf(room)}
                assignments={assignmentsByRoom.get(room.id) ?? []}
                guestMap={guestMap}
                warnings={warningsByRoom.get(room.id) ?? []}
                hotelName={hotels.length > 1 ? hotelName.get(room.hotel_id) : undefined}
                canEdit={canEdit}
                picking={!!selected}
                onTap={tapRoom}
                roomOptions={roomOptions}
                onMove={place}
                onRemove={unplace}
              />
            ))}
          </div>

          {costs.occupiedRooms > 0 && (
            <div className="bg-muted/50 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border px-4 py-2 text-sm">
              <span className="font-medium">{t("board.costSummary")}</span>
              <span>{t("board.costPerNight", { amount: formatMoney(costs.totalPerNight, currency) })}</span>
              <span className="text-muted-foreground">
                {t("board.occupancy", {
                  occupied: costs.occupiedRooms,
                  total: costs.totalRooms,
                  guests: costs.totalGuests,
                })}
              </span>
            </div>
          )}
        </div>
      </div>

      <DragOverlay>
        {draggingGuest && (
          <div className="bg-card flex items-center gap-2 rounded-lg border-2 border-dashed px-3 py-1.5 text-sm shadow-lg">
            <GroupDot group={draggingGuest.group} />
            {draggingGuest.name}
          </div>
        )}
      </DragOverlay>

      {addDialog}

      <Dialog open={!!swap} onOpenChange={(o) => !o && setSwap(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("board.swap.title", { room: swapRoom ? roomTitle(swapRoom) : "" })}</DialogTitle>
            <DialogDescription>
              {swapFrom
                ? t("board.swap.text", { name: swapGuest?.name ?? "", from: roomTitle(swapFrom) })
                : t("board.swap.textNoRoom", { name: swapGuest?.name ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-1">
            {(swap ? (assignmentsByRoom.get(swap.roomId) ?? []) : []).map((a) => {
              const g = guestMap.get(a.guest_id);
              return (
                <li key={a.guest_id}>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    disabled={pending}
                    onClick={() => {
                      const s = swap!;
                      setSwap(null);
                      run(() => swapRoomGuests(s.guestId, a.guest_id), t("board.swap.done"));
                    }}
                  >
                    <ArrowLeftRight aria-hidden />
                    {g && <GroupDot group={g.group} />}
                    {t("board.swap.with", { name: g?.name ?? "?" })}
                  </Button>
                </li>
              );
            })}
          </ul>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSwap(null)}>
              {t("board.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DndContext>
  );
}

function EmptyState({
  hasHotels,
  canEdit,
  onAdd,
}: {
  hasHotels: boolean;
  canEdit: boolean;
  onAdd: () => void;
}) {
  const t = useTranslations("hotels");
  return (
    <div className="bg-card mx-auto flex max-w-lg flex-col items-center gap-4 rounded-2xl border border-dashed px-6 py-12 text-center">
      <span className="bg-primary-soft text-primary-ink inline-flex size-14 items-center justify-center rounded-full">
        <BedDouble className="size-7" aria-hidden />
      </span>
      <h1 className="text-3xl">{t("board.empty.title")}</h1>
      <p className="text-muted-foreground">{t("board.empty.text")}</p>
      <ol className="text-muted-foreground list-decimal space-y-1 ps-5 text-start text-sm">
        <li className={cn(hasHotels && "line-through")}>{t("board.empty.step1")}</li>
        <li>{t("board.empty.step2")}</li>
        <li>{t("board.empty.step3")}</li>
      </ol>
      {!hasHotels ? (
        <Button asChild>
          <Link href="/app/hotels">
            <Plus aria-hidden /> {t("board.empty.addHotel")}
          </Link>
        </Button>
      ) : (
        canEdit && (
          <Button onClick={onAdd}>
            <Plus aria-hidden /> {t("board.add.button")}
          </Button>
        )
      )}
    </div>
  );
}

function UnassignedZone() {
  const t = useTranslations("hotels");
  const { setNodeRef, isOver } = useDroppable({ id: "unassigned-zone" });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "hidden rounded-lg border-2 border-dashed px-3 py-2 text-center text-xs transition-colors md:block",
        isOver ? "border-destructive bg-destructive/10" : "border-muted",
      )}
    >
      <X className="me-1 inline size-3" aria-hidden />
      {t("board.dropToUnassign")}
    </div>
  );
}

function RsvpBadge({ status }: { status: RsvpStatus }) {
  const t = useTranslations("hotels");
  if (status === "attending") return null;
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium",
        status === "declined"
          ? "bg-destructive/10 text-destructive"
          : "bg-muted text-muted-foreground",
      )}
    >
      {t(status === "declined" ? "board.badge.declined" : "board.badge.notReplied")}
    </span>
  );
}

function WishIcon({ guest }: { guest: BoardGuest }) {
  const t = useTranslations("hotels");
  if (!guest.roomPrefShare && !guest.roomPrefAvoid) return null;
  const text = [
    guest.roomPrefShare && t("board.prefShare", { name: guest.roomPrefShare }),
    guest.roomPrefAvoid && t("board.prefAvoid", { name: guest.roomPrefAvoid }),
  ]
    .filter(Boolean)
    .join("\n");
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="img"
            tabIndex={0}
            aria-label={text}
            className="text-muted-foreground shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <MessageCircle className="size-3.5" aria-hidden />
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-56 text-xs whitespace-pre-line">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function SidebarGuest({
  guest,
  roomTitle: placedIn,
  selected,
  canEdit,
  onTap,
}: {
  guest: BoardGuest;
  roomTitle: string | null;
  selected: boolean;
  canEdit: boolean;
  onTap: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: guest.id,
    disabled: !canEdit,
  });
  const kid = guest.ageGroup === "child" || guest.ageGroup === "infant";

  return (
    <li
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      role="button"
      aria-pressed={selected}
      onClick={() => onTap(guest.id)}
      className={cn(
        "flex items-center gap-2 rounded-lg border px-2 py-1.5 text-sm transition-colors select-none",
        canEdit && "cursor-pointer md:cursor-grab md:active:cursor-grabbing",
        isDragging && "opacity-40",
        selected ? "border-primary bg-primary-soft ring-primary ring-1" : placedIn ? "bg-muted/40" : "bg-card",
      )}
    >
      <GroupDot group={guest.group} />
      {kid ? (
        <Baby className="size-3.5 shrink-0" aria-hidden />
      ) : (
        <User className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
      )}
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate", placedIn && "text-muted-foreground")}>{guest.name}</span>
        <span className="text-muted-foreground block truncate text-[11px]">
          {placedIn ? `${guest.householdName} · ${placedIn}` : guest.householdName}
        </span>
      </span>
      <RsvpBadge status={guest.rsvpStatus} />
      <WishIcon guest={guest} />
    </li>
  );
}

function FillBar({ occupants, capacity }: { occupants: number; capacity: number }) {
  const pct = capacity > 0 ? Math.min(100, (occupants / capacity) * 100) : 0;
  return (
    <div className="bg-muted h-1.5 overflow-hidden rounded-full">
      <div
        className={cn(
          "h-full rounded-full transition-all",
          occupants > capacity ? "bg-destructive" : occupants === capacity ? "bg-warning" : "bg-primary",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

type RoomOption = { id: string; title: string; hotel?: string; free: number };

function RoomCard({
  room,
  roomType,
  capacity,
  assignments,
  guestMap,
  warnings,
  hotelName,
  canEdit,
  picking,
  onTap,
  roomOptions,
  onMove,
  onRemove,
}: {
  room: HotelRoomRow;
  roomType?: RoomTypeItem;
  capacity: number;
  assignments: HotelRoomAssignmentRow[];
  guestMap: Map<string, BoardGuest>;
  warnings: RoomWarning[];
  hotelName?: string;
  canEdit: boolean;
  picking: boolean;
  onTap: (roomId: string) => void;
  roomOptions: RoomOption[];
  onMove: (guestId: string, roomId: string) => void;
  onRemove: (guestId: string) => void;
}) {
  const t = useTranslations("hotels");
  const { setNodeRef, isOver } = useDroppable({ id: `room-${room.id}`, disabled: !canEdit });
  const occupants = assignments.length;
  const unlimited = capacity >= 99;
  const free = capacity - occupants;
  const beds = (roomType?.beds ?? []) as BedConfig[];
  const spots = bedSpots(beds);
  const problems = warnings.filter((w) => w.kind !== "stranger_pair");
  const mixed = warnings.some((w) => w.kind === "stranger_pair");

  return (
    <div
      ref={setNodeRef}
      onClick={() => picking && onTap(room.id)}
      onKeyDown={(e) => picking && (e.key === "Enter" || e.key === " ") && onTap(room.id)}
      role={picking ? "button" : undefined}
      tabIndex={picking ? 0 : undefined}
      aria-label={picking ? t("board.placeHere", { room: roomTitle(room) }) : undefined}
      className={cn(
        "bg-card flex flex-col gap-2 rounded-xl border p-3 transition-colors",
        isOver && (free > 0 ? "ring-primary ring-2" : "ring-warning ring-2"),
        picking && "hover:ring-primary cursor-pointer hover:ring-2",
        room.is_locked && "border-warning/40",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{roomTitle(room)}</p>
          <p className="text-muted-foreground truncate text-xs">
            {[room.name ? room.room_number : null, hotelName, roomType?.name].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {room.is_locked && <Lock className="text-warning size-3.5" aria-label={t("rooms.locked")} />}
          {roomType?.accessible && <span className="text-xs" aria-label={t("rooms.accessible")}>♿</span>}
          {canEdit && <RoomEditPopover room={room} typeCapacity={roomType?.max_guests ?? null} />}
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-baseline justify-between text-xs">
          <span className="font-medium tabular-nums">
            {unlimited ? occupants : t("board.ofCapacity", { count: occupants, capacity })}
          </span>
          {!unlimited && (
            <span className={cn("text-muted-foreground", free < 0 && "text-destructive font-medium")}>
              {free > 0
                ? t("board.free", { count: free })
                : free === 0
                  ? t("board.full")
                  : t("board.over", { count: -free })}
            </span>
          )}
        </div>
        {!unlimited && <FillBar occupants={occupants} capacity={capacity} />}
        {beds.length > 0 && (
          <p className="text-muted-foreground text-[11px]">
            {beds.map((b) => `${b.count}× ${BED_ICONS[b.kind] ?? ""}`).join(" ")}
            {spots != null && ` · ${t("board.bedsFor", { count: spots })}`}
          </p>
        )}
      </div>

      {(problems.length > 0 || mixed) && (
        <ul className="space-y-0.5 text-[11px]">
          {problems.map((w, i) => (
            <li key={`${w.kind}-${i}`} className="text-warning flex items-center gap-1">
              <AlertTriangle className="size-3 shrink-0" aria-hidden />
              {t(`board.warning.${w.kind}`)}
            </li>
          ))}
          {mixed && (
            <li className="text-muted-foreground flex items-center gap-1">
              <Users className="size-3 shrink-0" aria-hidden />
              {t("board.strangerHint")}
            </li>
          )}
        </ul>
      )}

      {occupants > 0 ? (
        <ul className="space-y-1">
          {assignments.map((a) => (
            <RoomGuestChip
              key={a.guest_id}
              assignment={a}
              guest={guestMap.get(a.guest_id)}
              currentRoom={room.id}
              canEdit={canEdit}
              roomOptions={roomOptions}
              onMove={onMove}
              onRemove={onRemove}
            />
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground py-2 text-center text-xs italic">{t("board.emptyRoom")}</p>
      )}
    </div>
  );
}

function RoomGuestChip({
  assignment: a,
  guest,
  currentRoom,
  canEdit,
  roomOptions,
  onMove,
  onRemove,
}: {
  assignment: HotelRoomAssignmentRow;
  guest: BoardGuest | undefined;
  currentRoom: string;
  canEdit: boolean;
  roomOptions: RoomOption[];
  onMove: (guestId: string, roomId: string) => void;
  onRemove: (guestId: string) => void;
}) {
  const t = useTranslations("hotels");
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: a.guest_id,
    disabled: !canEdit,
  });

  return (
    <li
      ref={setNodeRef}
      className={cn(
        "bg-muted/60 flex items-center gap-1.5 rounded-md py-0.5 ps-2 pe-0.5 text-sm",
        isDragging && "opacity-40",
        guest?.rsvpStatus === "declined" && "bg-destructive/10",
      )}
    >
      <span
        {...listeners}
        {...attributes}
        className={cn("flex min-w-0 flex-1 items-center gap-1.5", canEdit && "md:cursor-grab")}
      >
        {guest && <GroupDot group={guest.group} />}
        <span className="truncate">{guest?.name ?? "?"}</span>
        {a.needs_crib && <Baby className="size-3 shrink-0" aria-label={t("rooms.crib")} />}
      </span>
      {guest && <RsvpBadge status={guest.rsvpStatus} />}
      {guest && <WishIcon guest={guest} />}
      {canEdit && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="size-7 shrink-0 p-0"
              aria-label={t("board.guestMenu", { name: guest?.name ?? "" })}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="size-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
            <DropdownMenuLabel>{t("board.moveTo")}</DropdownMenuLabel>
            {roomOptions
              .filter((r) => r.id !== currentRoom)
              .map((r) => (
                <DropdownMenuItem key={r.id} onSelect={() => onMove(a.guest_id, r.id)}>
                  <span className="flex-1 truncate">
                    {r.title}
                    {r.hotel && <span className="text-muted-foreground"> · {r.hotel}</span>}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {r.free >= 90 ? "" : r.free > 0 ? t("board.free", { count: r.free }) : t("board.full")}
                  </span>
                </DropdownMenuItem>
              ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => onRemove(a.guest_id)}>
              <X aria-hidden /> {t("board.removeFromRoom")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  );
}

function RoomEditPopover({
  room,
  typeCapacity,
}: {
  room: HotelRoomRow;
  typeCapacity: number | null;
}) {
  const t = useTranslations("hotels");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(room.name ?? "");
  const [capacity, setCapacity] = useState(room.capacity?.toString() ?? "");
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const n = capacity.trim() === "" ? null : Number(capacity);
      const r = await updateRoomDetails(room.id, { name, capacity: n });
      if (r.ok) {
        toast.success(t("board.edit.saved"));
        setOpen(false);
      } else toast.error(r.error);
    });

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setName(room.name ?? "");
          setCapacity(room.capacity?.toString() ?? "");
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="size-7 p-0"
          aria-label={t("board.edit.title", { room: roomTitle(room) })}
          onClick={(e) => e.stopPropagation()}
        >
          <Pencil className="size-3.5" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" onClick={(e) => e.stopPropagation()}>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="space-y-1">
            <Label htmlFor={`rn-${room.id}`}>{t("board.edit.nickname")}</Label>
            <Input
              id={`rn-${room.id}`}
              value={name}
              maxLength={60}
              placeholder={t("board.edit.nicknameHint")}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`rc-${room.id}`}>{t("board.edit.capacity")}</Label>
            <Input
              id={`rc-${room.id}`}
              inputMode="numeric"
              value={capacity}
              placeholder={typeCapacity ? String(typeCapacity) : ""}
              onChange={(e) => setCapacity(e.target.value.replace(/\D/g, "").slice(0, 2))}
            />
            {typeCapacity != null && (
              <p className="text-muted-foreground text-xs">
                {t("board.edit.capacityHint", { count: typeCapacity })}
              </p>
            )}
          </div>
          <Button type="submit" size="sm" className="w-full" disabled={pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {t("board.edit.save")}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

function AddRoomsDialog({
  open,
  onOpenChange,
  hotels,
  defaultHotel,
  currency,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  hotels: Hotel[];
  defaultHotel?: string;
  currency: string;
}) {
  const t = useTranslations("hotels");
  const [pending, startTransition] = useTransition();
  const [hotelId, setHotelId] = useState(defaultHotel ?? "");
  const [count, setCount] = useState("5");
  const [perRoom, setPerRoom] = useState("4");
  const [start, setStart] = useState("101");
  const [beds, setBeds] = useState<Record<BedKind, string>>({
    double: "",
    single: "",
    sofa_bed: "",
    bunk: "",
  });
  const [price, setPrice] = useState<number | null>(null);
  const bedLabel = (k: BedKind) => t(`rooms.bed.${k}`);

  const n = Number(count) || 0;
  const per = Number(perRoom) || 0;
  const valid = !!hotelId && n >= 1 && n <= 100 && per >= 1 && per <= 20;

  const submit = () =>
    startTransition(async () => {
      const bedList = BED_KINDS.filter((k) => Number(beds[k]) > 0).map((k) => ({
        kind: k,
        count: Math.min(10, Number(beds[k])),
      }));
      const r = await addRoomsQuick({
        hotelId,
        typeName: t("board.add.typeName", { count: per }),
        count: n,
        perRoom: per,
        start,
        beds: bedList,
        pricePerNight: price,
      });
      if (r.ok) {
        toast.success(t("board.add.created", { count: r.data.created }));
        onOpenChange(false);
      } else toast.error(r.error);
    });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (o && !hotelId) setHotelId(defaultHotel ?? "");
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("board.add.title")}</DialogTitle>
          <DialogDescription>{t("board.add.text")}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) submit();
          }}
        >
          {hotels.length > 1 && (
            <div className="space-y-1">
              <Label htmlFor="ar-hotel">{t("hotel")}</Label>
              <Select value={hotelId} onValueChange={setHotelId}>
                <SelectTrigger id="ar-hotel" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {hotels.map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      {h.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ar-count">{t("board.add.count")}</Label>
              <Input
                id="ar-count"
                inputMode="numeric"
                value={count}
                onChange={(e) => setCount(e.target.value.replace(/\D/g, "").slice(0, 3))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ar-per">{t("board.add.perRoom")}</Label>
              <Input
                id="ar-per"
                inputMode="numeric"
                value={perRoom}
                onChange={(e) => setPerRoom(e.target.value.replace(/\D/g, "").slice(0, 2))}
              />
            </div>
          </div>
          <div className="flex gap-1" role="group" aria-label={t("board.add.perRoom")}>
            {[2, 3, 4, 5, 6].map((k) => (
              <Button
                key={k}
                type="button"
                size="sm"
                variant={per === k ? "secondary" : "outline"}
                className="flex-1"
                aria-pressed={per === k}
                onClick={() => setPerRoom(String(k))}
              >
                {k}
              </Button>
            ))}
          </div>
          <div className="space-y-1">
            <Label htmlFor="ar-start">{t("board.add.start")}</Label>
            <Input
              id="ar-start"
              value={start}
              maxLength={30}
              onChange={(e) => setStart(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">{t("board.add.startHint")}</p>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t("board.add.beds")}</legend>
            <div className="grid grid-cols-2 gap-2">
              {BED_KINDS.map((k) => (
                <Label key={k} className="justify-between gap-2 font-normal">
                  <span>
                    {BED_ICONS[k]} {bedLabel(k)}
                  </span>
                  <Input
                    className="h-8 w-14"
                    inputMode="numeric"
                    placeholder="0"
                    value={beds[k]}
                    onChange={(e) =>
                      setBeds((b) => ({ ...b, [k]: e.target.value.replace(/\D/g, "").slice(0, 2) }))
                    }
                  />
                </Label>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">{t("board.add.bedsHint")}</p>
          </fieldset>
          <div className="space-y-1">
            <Label htmlFor="ar-price">{t("board.add.price")}</Label>
            <MoneyInput id="ar-price" currency={currency} allowEmpty value={price} onChange={setPrice} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t("board.cancel")}
            </Button>
            <Button type="submit" disabled={!valid || pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              {t("board.add.create", { count: n })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
