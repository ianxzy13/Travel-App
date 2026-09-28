import type React from "react";
import { initials, isTable, KINDS, SEAT_SIZE, seatPositions } from "@/lib/seating/geometry";
import type { SeatingGuest, SeatingObject } from "@/lib/seating/types";
import { useSeatingWords } from "./use-seating-words";

// SVG drawings of tables, seats and decor. Units are centimetres; the
// floor plan scales everything with zoom. Used by the editor and for printing.

export type ColorMode = "side" | "meal" | "none";

// Colours come from app/theme.css.
const SIDE_COLORS = {
  partner_a: "var(--seat-side-a)",
  partner_b: "var(--seat-side-b)",
  both: "var(--seat-side-both)",
};
const MEAL_COLORS = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `var(--seat-${n})`);
const NO_MEAL = "var(--seat-no-meal)";

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
  words: { sideOf: (name: string) => string; both: string; noMeal: string },
) {
  if (mode === "side") {
    return [
      { color: SIDE_COLORS.partner_a, label: words.sideOf(names.a) },
      { color: SIDE_COLORS.partner_b, label: words.sideOf(names.b) },
      { color: SIDE_COLORS.both, label: words.both },
    ];
  }
  if (mode === "meal") {
    return [
      ...meals.map((m, i) => ({ color: MEAL_COLORS[i % MEAL_COLORS.length], label: m.name })),
      { color: NO_MEAL, label: words.noMeal },
    ];
  }
  return [];
}

const DECOR_STYLE: Partial<
  Record<SeatingObject["kind"], { fill: string; stroke: string; dash?: string }>
> = {
  dance_floor: { fill: "url(#dance-floor)", stroke: "var(--taupe-soft)" },
  stage: { fill: "var(--sand)", stroke: "var(--taupe-soft)" },
  bar: { fill: "var(--blush)", stroke: "var(--taupe-soft)" },
  buffet: { fill: "var(--sand)", stroke: "var(--taupe-soft)" },
  cake: { fill: "var(--primary-soft)", stroke: "var(--primary)" },
  entrance: { fill: "var(--tint-sage)", stroke: "var(--tint-sage-fg)", dash: "8 6" },
  pillar: { fill: "var(--taupe-soft)", stroke: "var(--muted-foreground)" },
  label: { fill: "transparent", stroke: "transparent" },
};

/** Shared <defs> (patterns) for any SVG that draws seating objects. */
export function SeatingDefs() {
  return (
    <defs>
      <pattern id="dance-floor" width="50" height="50" patternUnits="userSpaceOnUse">
        <rect width="50" height="50" fill="var(--card)" />
        <rect width="25" height="25" fill="var(--sand)" />
        <rect x="25" y="25" width="25" height="25" fill="var(--sand)" />
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
  const { t } = useSeatingWords();
  const info = KINDS[o.kind];
  const table = isTable(o.kind);
  const style = DECOR_STYLE[o.kind];
  const stroke = selected ? "var(--primary)" : table ? "var(--foreground)" : style?.stroke;
  const strokeWidth = selected ? 5 : table ? 1.5 : 2;
  const labelText = table
    ? (o.label ?? (o.number != null ? String(o.number) : ""))
    : (o.label ?? t(`kinds.${o.kind}`));
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
            fill={o.kind === "pillar" ? "var(--background)" : "var(--foreground)"}
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
  if (!guest) return <circle r={r} fill="#fff" stroke="var(--taupe-soft)" strokeDasharray="4 3" />;
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
