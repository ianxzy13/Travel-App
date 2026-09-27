"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Maximize, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { initials, isTable, SEAT_SIZE } from "@/lib/seating/geometry";
import { useSeatingWords } from "./use-seating-words";
import type { TableIssue } from "@/lib/seating/rules";
import { seatMap } from "@/lib/seating/state";
import type { SeatingGuest, SeatingObject, SeatingState } from "@/lib/seating/types";
import { guestColor, ObjectShape, SeatingDefs, type ColorMode } from "./shapes";

export type FloorPlanApi = {
  fit: () => void;
  zoomBy: (factor: number) => void;
  /** centre of what's visible, in room coordinates (for placing new tables) */
  center: () => { x: number; y: number };
};

type View = { s: number; tx: number; ty: number };

type Props = {
  state: SeatingState;
  guestsById: Map<string, SeatingGuest>;
  mealLookup: Map<string, string>;
  mealIds: string[];
  colorMode: ColorMode;
  issuesByTable: Record<string, TableIssue[]>;
  selectedId: string | null;
  selectedSeat: { objectId: string; seatIndex: number } | null;
  /** a guest or household is "picked" for tap-to-place */
  picking: boolean;
  canEdit: boolean;
  snap: boolean;
  grid: number;
  onSelect: (id: string | null) => void;
  onSeatClick: (objectId: string, seatIndex: number) => void;
  onTableActivate: (objectId: string) => void;
  onPreview: (next: SeatingState) => void;
  onCommit: (next: SeatingState, base: SeatingState) => void;
  apiRef: React.RefObject<FloorPlanApi | null>;
  children?: React.ReactNode;
};

const MIN_SCALE = 0.05;
const MAX_SCALE = 4;

export function FloorPlan(props: Props) {
  const { state, canEdit, onSelect } = props;
  const { t } = useSeatingWords();
  const containerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ s: 0.4, tx: 20, ty: 20 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const stateRef = useRef(state);
  stateRef.current = state;

  // ---------- view: fit, zoom, pan ----------

  const fit = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const { room, objects } = stateRef.current;
    // Frame the tables (plus room for their seats); the whole room if it's empty.
    const list = Object.values(objects);
    const box = list.length
      ? list.reduce(
          (b, o) => {
            const r = Math.max(o.width, o.height) / 2 + 60;
            return {
              x0: Math.min(b.x0, o.x - r),
              y0: Math.min(b.y0, o.y - r),
              x1: Math.max(b.x1, o.x + r),
              y1: Math.max(b.y1, o.y + r),
            };
          },
          { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity },
        )
      : { x0: 0, y0: 0, x1: room.width, y1: room.height };
    const bw = box.x1 - box.x0;
    const bh = box.y1 - box.y0;
    const s = Math.min(MAX_SCALE, Math.min(width / bw, height / bh) * 0.92);
    setView({ s, tx: (width - bw * s) / 2 - box.x0 * s, ty: (height - bh * s) / 2 - box.y0 * s });
  }, []);

  const zoomAt = useCallback((px: number, py: number, factor: number) => {
    setView((v) => {
      const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.s * factor));
      return { s, tx: px - ((px - v.tx) * s) / v.s, ty: py - ((py - v.ty) * s) / v.s };
    });
  }, []);

  useLayoutEffect(() => {
    fit();
    // refit when the room size changes
  }, [fit, state.room.width, state.room.height]);

  useEffect(() => {
    props.apiRef.current = {
      fit,
      zoomBy: (f) => {
        const r = containerRef.current?.getBoundingClientRect();
        if (r) zoomAt(r.width / 2, r.height / 2, f);
      },
      center: () => {
        const r = containerRef.current?.getBoundingClientRect();
        const v = viewRef.current;
        if (!r) return { x: stateRef.current.room.width / 2, y: stateRef.current.room.height / 2 };
        return { x: (r.width / 2 - v.tx) / v.s, y: (r.height / 2 - v.ty) / v.s };
      },
    };
  });

  // Mouse wheel / trackpad zoom (needs a non-passive listener to stop page scroll).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  /** Screen position → room position (centimetres). */
  const toRoomPoint = useCallback((clientX: number, clientY: number) => {
    const r = containerRef.current!.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (clientX - r.left - v.tx) / v.s, y: (clientY - r.top - v.ty) / v.s };
  }, []);

  // Panning with one finger/mouse, pinch-zoom with two fingers, on the empty floor.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const panMoved = useRef(false);
  const onBackgroundDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    panMoved.current = false;
  };
  const onBackgroundMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const all = [...pointers.current.entries()];
    if (all.length === 1) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) panMoved.current = true;
      setView((v) => ({ ...v, tx: v.tx + dx, ty: v.ty + dy }));
    } else if (all.length === 2) {
      const other = all.find(([id]) => id !== e.pointerId)![1];
      const before = Math.hypot(prev.x - other.x, prev.y - other.y);
      const after = Math.hypot(e.clientX - other.x, e.clientY - other.y);
      const r = containerRef.current!.getBoundingClientRect();
      if (before > 0)
        zoomAt(
          (e.clientX + other.x) / 2 - r.left,
          (e.clientY + other.y) / 2 - r.top,
          after / before,
        );
      panMoved.current = true;
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const onBackgroundUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0 && !panMoved.current) onSelect(null); // a tap on the floor deselects
  };

  // ---------- moving tables ----------

  const drag = useRef<{
    id: string;
    start: { x: number; y: number };
    origin: { x: number; y: number };
    base: SeatingState;
    moved: boolean;
  } | null>(null);

  const onObjectDown = (o: SeatingObject) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (props.picking && isTable(o.kind)) {
      props.onTableActivate(o.id);
      return;
    }
    onSelect(o.id);
    if (!canEdit) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag.current = {
      id: o.id,
      start: toRoomPoint(e.clientX, e.clientY),
      origin: { x: o.x, y: o.y },
      base: stateRef.current,
      moved: false,
    };
  };

  const onObjectMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const p = toRoomPoint(e.clientX, e.clientY);
    let x = d.origin.x + p.x - d.start.x;
    let y = d.origin.y + p.y - d.start.y;
    if (props.snap) {
      x = Math.round(x / props.grid) * props.grid;
      y = Math.round(y / props.grid) * props.grid;
    }
    const { room } = stateRef.current;
    x = Math.max(0, Math.min(room.width, x));
    y = Math.max(0, Math.min(room.height, y));
    const o = stateRef.current.objects[d.id];
    if (!o || (o.x === x && o.y === y)) return;
    d.moved = true;
    props.onPreview({
      ...stateRef.current,
      objects: { ...stateRef.current.objects, [d.id]: { ...o, x, y } },
    });
  };

  const onObjectUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.moved) props.onCommit(stateRef.current, d.base);
  };

  // ---------- drawing ----------

  const seats = seatMap(state);
  const objects = Object.values(state.objects).sort(
    (a, b) => Number(isTable(a.kind)) - Number(isTable(b.kind)), // decor underneath tables
  );
  const gridLines = Math.max(50, props.grid);

  return (
    <div
      ref={containerRef}
      className="bg-muted/40 relative size-full overflow-hidden rounded-xl border select-none"
      style={{ touchAction: "none" }}
    >
      <svg className="absolute inset-0 size-full" role="application" aria-label={t("floorPlanLabel")}>
        <SeatingDefs />
        <defs>
          <pattern
            id="room-grid"
            width={gridLines}
            height={gridLines}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${gridLines} 0 L 0 0 0 ${gridLines}`}
              fill="none"
              stroke="var(--border)"
              strokeWidth={1}
            />
          </pattern>
        </defs>
        {/* empty floor: pan / pinch / deselect */}
        <rect
          width="100%"
          height="100%"
          fill="transparent"
          onPointerDown={onBackgroundDown}
          onPointerMove={onBackgroundMove}
          onPointerUp={onBackgroundUp}
          onPointerCancel={onBackgroundUp}
          style={{ cursor: "grab" }}
        />
        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.s})`}>
          <rect
            width={state.room.width}
            height={state.room.height}
            fill="var(--background)"
            stroke="var(--muted-foreground)"
            strokeWidth={3 / view.s}
            style={{ pointerEvents: "none" }}
          />
          <rect
            width={state.room.width}
            height={state.room.height}
            fill="url(#room-grid)"
            style={{ pointerEvents: "none" }}
          />

          {objects.map((o) => (
            <PlacedObject
              key={o.id}
              object={o}
              props={props}
              seats={seats}
              onDown={onObjectDown(o)}
              onMove={onObjectMove}
              onUp={onObjectUp}
            />
          ))}
        </g>
      </svg>

      {props.children}

      <div className="bg-card/95 absolute right-3 bottom-3 flex items-center gap-1 rounded-lg border p-1 shadow-sm">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => props.apiRef.current?.zoomBy(1 / 1.25)}
          aria-label={t("zoomOut")}
        >
          <Minus aria-hidden />
        </Button>
        <span className="w-12 text-center text-xs tabular-nums">{Math.round(view.s * 100)}%</span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => props.apiRef.current?.zoomBy(1.25)}
          aria-label={t("zoomIn")}
        >
          <Plus aria-hidden />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={fit} aria-label={t("fit")}>
          <Maximize aria-hidden />
        </Button>
      </div>
    </div>
  );
}

/** One table/decor item with interactive seats. */
function PlacedObject({
  object: o,
  props,
  seats,
  onDown,
  onMove,
  onUp,
}: {
  object: SeatingObject;
  props: Props;
  seats: Map<string, string>;
  onDown: (e: React.PointerEvent) => void;
  onMove: (e: React.PointerEvent) => void;
  onUp: () => void;
}) {
  const table = isTable(o.kind);
  const { setNodeRef, isOver } = useDroppable({
    id: `table:${o.id}`,
    disabled: !table || !props.canEdit,
  });
  const seated = [...seats.entries()].filter(([k]) => k.startsWith(`${o.id}:`)).length;
  const issues = props.issuesByTable[o.id] ?? [];
  const { t, tableName } = useSeatingWords();

  return (
    <ObjectShape
      object={o}
      selected={props.selectedId === o.id || isOver}
      warning={issues.length > 0}
      bodyProps={{
        ref: setNodeRef as unknown as React.Ref<SVGGElement>,
        onPointerDown: onDown,
        onPointerMove: onMove,
        onPointerUp: onUp,
        onPointerCancel: onUp,
        role: "button",
        tabIndex: 0,
        "aria-label": table
          ? t("tableAria", { name: tableName(o), seated, total: o.seatCount }) +
            (issues.length ? t("tableWarnings", { count: issues.length }) : "")
          : tableName(o),
        onKeyDown: (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (props.picking && table) props.onTableActivate(o.id);
            else props.onSelect(o.id);
          }
        },
        style: {
          cursor: props.picking && table ? "copy" : props.canEdit ? "move" : "pointer",
          outline: "none",
        },
      }}
      renderSeat={(i) => (
        <SeatNode
          objectId={o.id}
          index={i}
          guest={props.guestsById.get(seats.get(`${o.id}:${i}`) ?? "")}
          rotation={o.rotation}
          tableLabel={tableName(o)}
          props={props}
        />
      )}
    />
  );
}

/** A seat: drop target for guests, and draggable when someone sits in it. */
function SeatNode({
  objectId,
  index,
  guest,
  rotation,
  tableLabel,
  props,
}: {
  objectId: string;
  index: number;
  guest: SeatingGuest | undefined;
  rotation: number;
  tableLabel: string;
  props: Props;
}) {
  const drop = useDroppable({ id: `seat:${objectId}:${index}`, disabled: !props.canEdit });
  const dragItem = useDraggable({
    id: guest ? `seat-guest:${guest.id}` : `empty:${objectId}:${index}`,
    disabled: !guest || !props.canEdit,
  });
  const setRef = (el: SVGGElement | null) => {
    drop.setNodeRef(el as unknown as HTMLElement);
    dragItem.setNodeRef(el as unknown as HTMLElement);
  };
  const selected =
    props.selectedSeat?.objectId === objectId && props.selectedSeat.seatIndex === index;
  const r = SEAT_SIZE / 2;
  const { t } = useSeatingWords();
  const meal = guest?.mealOptionId ? props.mealLookup.get(guest.mealOptionId) : null;
  const details = guest
    ? [
        guest.name,
        meal && t("mealLine", { meal }),
        guest.dietary && t("dietaryLine", { text: guest.dietary }),
      ]
        .filter(Boolean)
        .join("\n")
    : t("emptySeat", { n: index + 1, table: tableLabel });

  return (
    <g
      ref={setRef}
      {...dragItem.listeners}
      {...(guest ? dragItem.attributes : {})}
      role="button"
      tabIndex={0}
      aria-label={
        guest ? `${details.replace(/\n/g, ", ")}, seat ${index + 1} at ${tableLabel}` : details
      }
      aria-pressed={selected}
      onClick={(e) => {
        e.stopPropagation();
        props.onSeatClick(objectId, index);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          props.onSeatClick(objectId, index);
        }
      }}
      onPointerDown={(e) => {
        e.stopPropagation(); // don't start moving the table
        dragItem.listeners?.onPointerDown?.(e);
      }}
      style={{
        cursor: guest && props.canEdit ? "grab" : "pointer",
        opacity: dragItem.isDragging ? 0.4 : 1,
        outline: "none",
      }}
    >
      <title>{details}</title>
      {guest ? (
        <>
          <circle r={r} fill={guestColor(guest, props.colorMode, props.mealIds)} />
          <text
            transform={`rotate(${-rotation})`}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={17}
            fontWeight={600}
            fill="#fff"
            style={{ pointerEvents: "none" }}
          >
            {initials(guest.name)}
          </text>
          {(guest.dietary || guest.rsvp === "declined") && (
            <circle
              cx={r * 0.72}
              cy={-r * 0.72}
              r={7}
              fill={guest.rsvp === "declined" ? "var(--destructive)" : "var(--warning)"}
              stroke="#fff"
              strokeWidth={2}
            />
          )}
        </>
      ) : (
        <circle
          r={r}
          fill={props.picking ? "var(--primary-soft)" : "var(--card)"}
          stroke="var(--muted-foreground)"
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />
      )}
      {(selected || drop.isOver) && (
        <circle
          r={r + 5}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={4}
          style={{ pointerEvents: "none" }}
        />
      )}
    </g>
  );
}
