import type React from "react";
import { initials, isTable, KINDS, SEAT_SIZE, seatPositions } from "@/lib/seating/geometry";
import type { SeatingGuest, SeatingObject } from "@/lib/seating/types";

// SVG drawings of tables, seats and decor. Units are centimetres; the
// floor plan scales everything with zoom. Used by the editor and for printing.

export type ColorMode = "side" | "meal" | "none";

const SIDE_COLORS = { partner_a: "var(--primary)", partner_b: "#0ea5e9", both: "#a8a29e" };
const MEAL_COLORS = [
  "#b45309",
  "#0f766e",
  "#7c3aed",
  "#be123c",
  "#1d4ed8",
  "#4d7c0f",
  "#a21caf",
  "#0e7490",
];
const NO_MEAL = "#a8a29e";

/** Colour of a seated guest in the chosen colour mode. */
export function guestColor(guest: SeatingGuest | undefined, mode: ColorMode, mealIds: string[]) {
  if (!guest || mode === "none") return "var(--primary)";
  if (mode === "side") return SIDE_COLORS[guest.side];
  const i = guest.mealOptionId ? mealIds.indexOf(guest.mealOptionId) : -1;
  return i >= 0 ? MEAL_COLORS[i % MEAL_COLORS.length] : NO_MEAL;
}

export function legendItems(
  mode: ColorMode,
  names: { a: string; b: string },
  meals: { id: string; name: string }[],
) {
  if (mode === "side") {
    return [
      { color: SIDE_COLORS.partner_a, label: `${names.a}'s side` },
      { color: SIDE_COLORS.partner_b, label: `${names.b}'s side` },
      { color: SIDE_COLORS.both, label: "Both" },
    ];
  }
  if (mode === "meal") {
    return [
      ...meals.map((m, i) => ({ color: MEAL_COLORS[i % MEAL_COLORS.length], label: m.name })),
      { color: NO_MEAL, label: "No meal chosen" },
    ];
  }
  return [];
}

const DECOR_STYLE: Partial<
  Record<SeatingObject["kind"], { fill: string; stroke: string; dash?: string }>
> = {
  dance_floor: { fill: "url(#dance-floor)", stroke: "#a8a29e" },
  stage: { fill: "#e7e5e4", stroke: "#78716c" },
  bar: { fill: "#d6d3d1", stroke: "#78716c" },
  buffet: { fill: "#e7e5e4", stroke: "#78716c" },
  cake: { fill: "#fce7f3", stroke: "#be185d" },
  entrance: { fill: "#dcfce7", stroke: "#15803d", dash: "8 6" },
  pillar: { fill: "#57534e", stroke: "#44403c" },
  label: { fill: "transparent", stroke: "transparent" },
};

/** Shared <defs> (patterns) for any SVG that draws seating objects. */
export function SeatingDefs() {
  return (
    <defs>
      <pattern id="dance-floor" width="50" height="50" patternUnits="userSpaceOnUse">
        <rect width="50" height="50" fill="#f5f5f4" />
        <rect width="25" height="25" fill="#e7e5e4" />
        <rect x="25" y="25" width="25" height="25" fill="#e7e5e4" />
      </pattern>
    </defs>
  );
}

type ShapeProps = {
  object: SeatingObject;
  selected?: boolean;
  /** red badge when the table has problems */
  warning?: boolean;
  /** extra props for the table body (pointer handlers, refs…) */
  bodyProps?: React.SVGProps<SVGGElement> & { ref?: React.Ref<SVGGElement> };
  /** draws each seat; default draws a plain seat */
  renderSeat?: (index: number, pos: { x: number; y: number }) => React.ReactNode;
};

/** A table (with its seats) or a decor item, positioned and rotated in the room. */
export function ObjectShape({ object: o, selected, warning, bodyProps, renderSeat }: ShapeProps) {
  const info = KINDS[o.kind];
  const table = isTable(o.kind);
  const style = DECOR_STYLE[o.kind];
  const stroke = selected ? "var(--primary)" : table ? "var(--foreground)" : style?.stroke;
  const strokeWidth = selected ? 5 : table ? 1.5 : 2;
  const labelText = table
    ? (o.label ?? (o.number != null ? String(o.number) : ""))
    : (o.label ?? info.label);
  const upright = `rotate(${-o.rotation})`; // keep text readable at any angle

  return (
    <g transform={`translate(${o.x} ${o.y}) rotate(${o.rotation})`}>
      <g {...bodyProps}>
        {info.round ? (
          <circle
            r={o.width / 2}
            fill={table ? "var(--card)" : style?.fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        ) : (
          <rect
            x={-o.width / 2}
            y={-o.height / 2}
            width={o.width}
            height={o.height}
            rx={table ? 6 : o.kind === "label" ? 0 : 4}
            fill={table ? "var(--card)" : style?.fill}
            stroke={o.kind === "label" && selected ? "var(--primary)" : stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={style?.dash ?? (o.kind === "label" && selected ? "6 4" : undefined)}
          />
        )}
        {labelText && (
          <text
            transform={upright}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={
              table ? (o.label ? Math.min(28, o.width / 5) : 36) : o.kind === "label" ? 30 : 22
            }
            fontFamily={table && !o.label ? "var(--font-serif)" : "var(--font-sans)"}
            fontWeight={table ? 600 : 500}
            fill={o.kind === "pillar" ? "#fafaf9" : "var(--foreground)"}
            style={{ pointerEvents: "none", userSelect: "none" }}
          >
            {o.kind === "pillar" ? "" : labelText}
          </text>
        )}
      </g>

      {table &&
        seatPositions(o).map((pos, i) => (
          <g key={i} transform={`translate(${pos.x} ${pos.y})`}>
            {renderSeat ? (
              renderSeat(i, pos)
            ) : (
              <circle r={SEAT_SIZE / 2} fill="var(--muted)" stroke="var(--border)" />
            )}
          </g>
        ))}

      {warning && (
        <g
          transform={`translate(${o.width / 2 + 4} ${-o.height / 2 - 4}) ${upright}`}
          style={{ pointerEvents: "none" }}
        >
          <circle r={16} fill="var(--destructive)" />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={22}
            fontWeight={700}
            fill="#fff"
          >
            !
          </text>
        </g>
      )}
    </g>
  );
}

/** A plain seat for printing: coloured with initials, or empty. */
export function StaticSeat({
  guest,
  color,
  rotation,
}: {
  guest?: SeatingGuest;
  color: string;
  rotation: number;
}) {
  const r = SEAT_SIZE / 2;
  if (!guest) return <circle r={r} fill="#fff" stroke="#a8a29e" strokeDasharray="4 3" />;
  return (
    <g>
      <circle r={r} fill={color} />
      <text
        transform={`rotate(${-rotation})`}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={17}
        fontWeight={600}
        fill="#fff"
      >
        {initials(guest.name)}
      </text>
    </g>
  );
}
