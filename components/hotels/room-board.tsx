"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
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
  Baby,
  Download,
  Loader2,
  Lock,
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
  assignGuestToRoom,
  autoArrangeRoomAssignments,
  unassignGuestFromRoom,
} from "@/app/app/hotels/room-actions";
import { autoArrangeRooms } from "@/lib/hotels/auto-arrange-rooms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  BedConfig,
  HotelRoomAssignmentRow,
  HotelRoomRow,
  HotelRoomTypeRow,
} from "@/lib/database.types";
import type { PickerGuest } from "@/components/guests/guest-picker";
import { computeRoomCosts } from "@/lib/hotels/room-costs";
import { checkRoomRules, warningCountByRoom } from "@/lib/hotels/room-rules";
import { formatMoney } from "@/lib/budget/money";
import { cn } from "@/lib/utils";

type RoomTypeItem = Omit<HotelRoomTypeRow, "price_per_night"> & {
  price_per_night: number | null;
};

type BoardGuest = PickerGuest & {
  attending: boolean;
  ageGroup: string;
  householdId: string;
  accessibility: string | null;
  /** the guest's answer on the RSVP page: "no" / "elsewhere" means they don't need a room */
  wantsRoom: string | null;
};

/** Coming, and didn't say they'll sleep somewhere else. */
const needsRoom = (g: BoardGuest) =>
  g.attending && g.wantsRoom !== "no" && g.wantsRoom !== "elsewhere";

type Relationship = {
  guestA: string;
  guestB: string;
  type: "keep_together" | "keep_apart";
};

type Props = {
  hotels: { id: string; name: string; price_per_night: number | null }[];
  roomTypes: RoomTypeItem[];
  rooms: HotelRoomRow[];
  roomAssignments: HotelRoomAssignmentRow[];
  guests: BoardGuest[];
  relationships: Relationship[];
  currency: string;
  canEdit: boolean;
};

const BED_ICONS: Record<string, string> = {
  double: "🛏️",
  single: "🛏️",
  sofa_bed: "🛋️",
  bunk: "🪜",
};

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
  const [showFilter, setShowFilter] = useState<"all" | "unassigned" | "kids" | "accessible">("all");

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const assignmentsByRoom = useMemo(() => {
    const map = new Map<string, HotelRoomAssignmentRow[]>();
    for (const a of roomAssignments) {
      const list = map.get(a.room_id) ?? [];
      list.push(a);
      map.set(a.room_id, list);
    }
    return map;
  }, [roomAssignments]);

  const assignedGuestIds = useMemo(
    () => new Set(roomAssignments.map((a) => a.guest_id)),
    [roomAssignments],
  );

  const guestMap = useMemo(
    () => new Map(guests.map((g) => [g.id, g])),
    [guests],
  );

  const typeMap = useMemo(
    () => new Map(roomTypes.map((rt) => [rt.id, rt])),
    [roomTypes],
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
    const attendingIds = new Set(guests.filter(needsRoom).map((g) => g.id));
    // an empty room is normal while planning, not a problem to warn about
    return checkRoomRules({
      rooms,
      roomTypes: new Map(roomTypes.map((rt) => [rt.id, rt as unknown as HotelRoomTypeRow])),
      assignments: roomAssignments,
      guests: ruleGuests,
      relationships,
      attendingGuestIds: attendingIds,
    }).filter((w) => w.kind !== "empty_room");
  }, [rooms, roomTypes, roomAssignments, guests, relationships]);

  const warningsByRoom = useMemo(() => warningCountByRoom(warnings), [warnings]);

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

  const filteredRooms = useMemo(() => {
    let list = rooms;
    if (hotelFilter !== "all") {
      list = list.filter((r) => r.hotel_id === hotelFilter);
    }
    return list;
  }, [rooms, hotelFilter]);

  const filteredGuests = useMemo(() => {
    let list = guests.filter(needsRoom);
    if (showFilter === "unassigned") {
      list = list.filter((g) => !assignedGuestIds.has(g.id));
    } else if (showFilter === "kids") {
      list = list.filter((g) => g.ageGroup === "child" || g.ageGroup === "infant");
    } else if (showFilter === "accessible") {
      list = list.filter((g) => g.accessibility);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((g) => g.name.toLowerCase().includes(q));
    }
    return list;
  }, [guests, showFilter, search, assignedGuestIds]);

  const unassignedCount = useMemo(
    () => guests.filter((g) => needsRoom(g) && !assignedGuestIds.has(g.id)).length,
    [guests, assignedGuestIds],
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setDragging(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setDragging(null);
      const guestId = String(event.active.id);
      const overId = event.over?.id ? String(event.over.id) : null;

      if (!overId || !canEdit) return;

      if (overId === "unassigned-zone") {
        if (assignedGuestIds.has(guestId)) {
          startTransition(async () => {
            const r = await unassignGuestFromRoom(guestId);
            if (r.ok) toast.success(t("board.removed"));
            else toast.error(r.error);
          });
        }
        return;
      }

      const roomId = overId.replace("room-", "");
      const room = rooms.find((r) => r.id === roomId);
      if (!room) return;

      const rt = room.room_type_id ? typeMap.get(room.room_type_id) : null;
      const currentOccupants = (assignmentsByRoom.get(roomId) ?? []).length;
      const maxGuests = rt?.max_guests ?? 99;

      const alreadyInRoom = roomAssignments.find(
        (a) => a.guest_id === guestId && a.room_id === roomId,
      );
      if (alreadyInRoom) return;

      if (currentOccupants >= maxGuests) {
        toast.error(t("board.roomFull"));
        return;
      }

      startTransition(async () => {
        const r = await assignGuestToRoom({
          roomId,
          guestId,
          checkIn: "",
          checkOut: "",
          needsCrib: false,
        });
        if (r.ok) toast.success(t("board.assigned"));
        else toast.error(r.error);
      });
    },
    [canEdit, rooms, roomAssignments, assignedGuestIds, assignmentsByRoom, typeMap, t, startTransition],
  );

  const draggingGuest = dragging ? guestMap.get(dragging) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col gap-4 md:h-full md:min-h-0 md:flex-row">
        {/* Guest sidebar (on top on phones) */}
        <div className="flex max-h-[45vh] w-full shrink-0 flex-col gap-3 overflow-hidden rounded-xl border p-3 md:max-h-none md:w-72">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">
              <Users className="me-1 inline size-4" aria-hidden />
              {t("board.guests")}
            </h3>
            <span className="text-muted-foreground text-xs">
              {t("board.unassigned", { count: unassignedCount })}
            </span>
          </div>

          <div className="relative">
            <Search className="text-muted-foreground absolute start-2 top-2 size-4" aria-hidden />
            <Input
              className="h-8 ps-8"
              placeholder={t("board.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-1">
            {(["all", "unassigned", "kids", "accessible"] as const).map((f) => (
              <Button
                key={f}
                variant={showFilter === f ? "secondary" : "ghost"}
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setShowFilter(f)}
              >
                {t(`board.filter.${f}`)}
              </Button>
            ))}
          </div>

          <UnassignedZone />

          <ul className="flex-1 space-y-1 overflow-y-auto">
            {filteredGuests.map((g) => (
              <DraggableGuest key={g.id} guest={g} assigned={assignedGuestIds.has(g.id)} />
            ))}
            {filteredGuests.length === 0 && (
              <p className="text-muted-foreground py-4 text-center text-xs">
                {t("board.noGuests")}
              </p>
            )}
          </ul>
        </div>

        {/* Room grid */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 md:overflow-hidden">
          <div className="flex flex-wrap items-center gap-2">
            {hotels.length > 1 && (
              <Select value={hotelFilter} onValueChange={setHotelFilter}>
                <SelectTrigger className="h-8 w-48">
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
              {t("board.roomCount", { count: filteredRooms.length })}
            </span>
            {canEdit && unassignedCount > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1 text-xs"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const ruleGuests = guests.filter(needsRoom).map((g) => ({
                      id: g.id,
                      name: g.name,
                      householdId: g.householdId,
                      ageGroup: g.ageGroup,
                      accessibility: g.accessibility,
                    }));
                    const result = autoArrangeRooms({
                      rooms,
                      roomTypes: new Map(
                        roomTypes.map((rt) => [rt.id, rt as unknown as import("@/lib/database.types").HotelRoomTypeRow]),
                      ),
                      existingAssignments: roomAssignments,
                      guests: ruleGuests,
                      relationships,
                    });
                    if (result.assignments.length) {
                      const r = await autoArrangeRoomAssignments(result.assignments);
                      if (r.ok) {
                        toast.success(
                          t("board.arranged", {
                            placed: result.placed.length,
                            unplaced: result.unplaced.length,
                          }),
                        );
                      } else {
                        toast.error(r.error);
                      }
                    } else {
                      toast(t("board.noRoomsAvailable"));
                    }
                  })
                }
              >
                {pending ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Sparkles className="size-3.5" aria-hidden />
                )}
                {t("board.autoArrange")}
              </Button>
            )}
            <div className="ms-auto flex flex-wrap items-center gap-2">
              {warnings.length > 0 && (
                <span className="flex items-center gap-1 text-sm text-amber-600">
                  <AlertTriangle className="size-4" aria-hidden />
                  {t("board.warnings", { count: warnings.length })}
                </span>
              )}
              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" asChild>
                <a href="/app/hotels/rooms/export" download>
                  <Download className="size-3.5" aria-hidden />
                  {t("export.csv")}
                </a>
              </Button>
              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" asChild>
                <Link href="/print/rooms" target="_blank">
                  <Printer className="size-3.5" aria-hidden />
                  {t("export.pdf")}
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid flex-1 grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] content-start gap-3 md:overflow-y-auto">
            {filteredRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                roomType={room.room_type_id ? typeMap.get(room.room_type_id) : undefined}
                assignments={assignmentsByRoom.get(room.id) ?? []}
                guestMap={guestMap}
                warningCount={warningsByRoom.get(room.id) ?? 0}
                canEdit={canEdit}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Cost summary bar */}
      {costs.occupiedRooms > 0 && (
        <div className="bg-muted/50 flex flex-wrap items-center gap-4 rounded-xl border px-4 py-2 text-sm">
          <span className="font-medium">{t("board.costSummary")}</span>
          <span>
            {t("board.costPerNight", { amount: formatMoney(costs.totalPerNight, currency) })}
          </span>
          <span className="text-muted-foreground">
            {t("board.occupancy", {
              occupied: costs.occupiedRooms,
              total: costs.totalRooms,
              guests: costs.totalGuests,
            })}
          </span>
        </div>
      )}

      <DragOverlay>
        {draggingGuest && (
          <div className="bg-card rounded-lg border-2 border-dashed px-3 py-1.5 text-sm shadow-lg">
            <User className="me-1 inline size-3.5" aria-hidden />
            {draggingGuest.name}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function UnassignedZone() {
  const t = useTranslations("hotels");
  const { setNodeRef, isOver } = useDroppable({ id: "unassigned-zone" });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg border-2 border-dashed px-3 py-2 text-center text-xs transition-colors",
        isOver ? "border-destructive bg-destructive/10" : "border-muted",
      )}
    >
      <X className="me-1 inline size-3" aria-hidden />
      {t("board.dropToUnassign")}
    </div>
  );
}

function DraggableGuest({
  guest,
  assigned,
}: {
  guest: BoardGuest;
  assigned: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: guest.id,
  });

  return (
    <li
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "flex cursor-grab items-center gap-2 rounded-lg border px-2 py-1.5 text-sm transition-colors active:cursor-grabbing",
        isDragging && "opacity-40",
        assigned ? "bg-muted/50 text-muted-foreground" : "bg-card",
      )}
    >
      {guest.ageGroup === "child" ? (
        <Baby className="size-3.5 shrink-0" aria-hidden />
      ) : guest.ageGroup === "infant" ? (
        <Baby className="size-3.5 shrink-0 text-pink-500" aria-hidden />
      ) : (
        <User className="size-3.5 shrink-0" aria-hidden />
      )}
      <span className="flex-1 truncate">{guest.name}</span>
      {assigned && <span className="text-xs">✓</span>}
    </li>
  );
}

function RoomCard({
  room,
  roomType,
  assignments,
  guestMap,
  warningCount,
  canEdit,
}: {
  room: HotelRoomRow;
  roomType?: RoomTypeItem;
  assignments: HotelRoomAssignmentRow[];
  guestMap: Map<string, BoardGuest>;
  warningCount: number;
  canEdit: boolean;
}) {
  const t = useTranslations("hotels");
  const [pending, startTransition] = useTransition();
  const { setNodeRef, isOver } = useDroppable({ id: `room-${room.id}` });
  const maxGuests = roomType?.max_guests ?? 99;
  const occupants = assignments.length;
  const isFull = occupants >= maxGuests;
  const beds = (roomType?.beds ?? []) as BedConfig[];

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-xl border p-3 transition-colors",
        isOver && !isFull && "ring-primary ring-2",
        isOver && isFull && "ring-destructive ring-2",
        room.is_locked && "border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/10",
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-sm font-medium">{room.room_number}</span>
        <div className="flex items-center gap-1">
          {warningCount > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-amber-600">
              <AlertTriangle className="size-3" aria-hidden />
              {warningCount}
            </span>
          )}
          {room.is_locked && <Lock className="size-3 text-amber-600" aria-hidden />}
          {roomType?.accessible && <span className="text-xs">♿</span>}
          {roomType?.has_crib && <Baby className="size-3 text-pink-400" aria-hidden />}
        </div>
      </div>

      {roomType && (
        <p className="text-muted-foreground mb-2 text-xs">
          {roomType.name}
          {" · "}
          {beds.map((b) => `${b.count}× ${BED_ICONS[b.kind] ?? ""}`).join(" ")}
        </p>
      )}

      <div className="mb-2 flex items-center gap-1 text-xs">
        <Users className="size-3" aria-hidden />
        <span className={cn(isFull && occupants > 0 && "text-amber-600 font-medium")}>
          {occupants}/{maxGuests}
        </span>
      </div>

      {assignments.length > 0 && (
        <ul className="space-y-1">
          {assignments.map((a) => {
            const guest = guestMap.get(a.guest_id);
            return (
              <li
                key={a.guest_id}
                className="bg-primary/10 flex items-center gap-1 rounded px-2 py-1 text-xs"
              >
                <User className="size-3 shrink-0" aria-hidden />
                <span className="flex-1 truncate">{guest?.name ?? "?"}</span>
                {a.needs_crib && <Baby className="size-3 text-pink-400" aria-hidden />}
                {canEdit && (
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const r = await unassignGuestFromRoom(a.guest_id);
                        if (r.ok) toast.success(t("board.removed"));
                        else toast.error(r.error);
                      })
                    }
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {occupants === 0 && (
        <p className="text-muted-foreground py-2 text-center text-xs italic">
          {t("board.emptyRoom")}
        </p>
      )}
    </div>
  );
}
