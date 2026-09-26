import type { SeatingKind, SeatingObject } from "./types";

// All measurements are centimetres.

/** Diameter of a drawn seat. */
export const SEAT_SIZE = 44;
/** Gap between a table edge and its seats. */
const SEAT_GAP = 6;
/** Table length per seat along a side. */
const SEAT_PITCH = 62;

type KindInfo = {
  label: string;
  /** can guests sit here? */
  seated: boolean;
  /** drawn as a circle */
  round: boolean;
  minSeats: number;
  maxSeats: number;
  defaultSeats: number;
  /** size for non-seated items (tables are sized from their seat count) */
  defaultSize?: { width: number; height: number };
};

export const KINDS: Record<SeatingKind, KindInfo> = {
  round: {
    label: "Round table",
    seated: true,
    round: true,
    minSeats: 2,
    maxSeats: 14,
    defaultSeats: 8,
  },
  rect: {
    label: "Banquet table",
    seated: true,
    round: false,
    minSeats: 2,
    maxSeats: 30,
    defaultSeats: 8,
  },
  square: {
    label: "Square table",
    seated: true,
    round: false,
    minSeats: 4,
    maxSeats: 16,
    defaultSeats: 8,
  },
  head: {
    label: "Head table",
    seated: true,
    round: false,
    minSeats: 2,
    maxSeats: 30,
    defaultSeats: 10,
  },
  sweetheart: {
    label: "Sweetheart table",
    seated: true,
    round: false,
    minSeats: 2,
    maxSeats: 2,
    defaultSeats: 2,
  },
  dance_floor: {
    label: "Dance floor",
    seated: false,
    round: false,
    minSeats: 0,
    maxSeats: 0,
    defaultSeats: 0,
    defaultSize: { width: 500, height: 500 },
  },
  stage: {
    label: "Stage / DJ",
    seated: false,
    round: false,
    minSeats: 0,
    maxSeats: 0,
    defaultSeats: 0,
    defaultSize: { width: 400, height: 250 },
  },
  bar: {
    label: "Bar",
    seated: false,
    round: false,
    minSeats: 0,
    maxSeats: 0,
    defaultSeats: 0,
    defaultSize: { width: 300, height: 80 },
  },
  buffet: {
    label: "Buffet",
    seated: false,
    round: false,
    minSeats: 0,
    maxSeats: 0,
    defaultSeats: 0,
    defaultSize: { width: 400, height: 90 },
  },
  cake: {
    label: "Cake table",
    seated: false,
    round: true,
    minSeats: 0,
    maxSeats: 0,
    defaultSeats: 0,
    defaultSize: { width: 100, height: 100 },
  },
  entrance: {
    label: "Entrance",
    seated: false,
    round: false,
    minSeats: 0,
    maxSeats: 0,
    defaultSeats: 0,
    defaultSize: { width: 200, height: 30 },
  },
  pillar: {
    label: "Pillar",
    seated: false,
    round: true,
    minSeats: 0,
    maxSeats: 0,
    defaultSeats: 0,
    defaultSize: { width: 50, height: 50 },
  },
  label: {
    label: "Text label",
    seated: false,
    round: false,
    minSeats: 0,
    maxSeats: 0,
    defaultSeats: 0,
    defaultSize: { width: 240, height: 50 },
  },
};

export const isTable = (kind: SeatingKind) => KINDS[kind].seated;

export function clampSeats(kind: SeatingKind, seats: number) {
  const k = KINDS[kind];
  return Math.max(k.minSeats, Math.min(k.maxSeats, Math.round(seats)));
}

/** How many seats go on the long sides of a banquet table. */
function banquetSideSeats(seatCount: number, ends: boolean) {
  return Math.max(0, seatCount - (ends ? 2 : 0));
}

/** Table size that comfortably fits its seats. */
export function tableSize(kind: SeatingKind, seatCount: number, ends = false) {
  switch (kind) {
    case "round": {
      // about 60 cm of edge per person
      const d = Math.max(80, Math.round((seatCount * 60) / Math.PI));
      return { width: d, height: d };
    }
    case "rect": {
      const perSide = Math.ceil(banquetSideSeats(seatCount, ends) / 2);
      return { width: Math.max(120, perSide * SEAT_PITCH), height: 80 };
    }
    case "square": {
      const side = Math.max(90, Math.ceil(seatCount / 4) * SEAT_PITCH);
      return { width: side, height: side };
    }
    case "head":
      return { width: Math.max(120, seatCount * SEAT_PITCH), height: 75 };
    case "sweetheart":
      return { width: 130, height: 70 };
    default:
      return KINDS[kind].defaultSize ?? { width: 100, height: 100 };
  }
}

/** Evenly spread `n` seats along a straight edge. */
function along(n: number, length: number, fixed: number, horizontal: boolean) {
  return Array.from({ length: n }, (_, i) => {
    const t = -length / 2 + ((i + 0.5) * length) / n;
    return horizontal ? { x: t, y: fixed } : { x: fixed, y: t };
  });
}

/**
 * Seat centres relative to the table's centre, BEFORE rotation.
 * Seat order goes around the table so neighbouring indices sit next to
 * each other (households get seated side by side).
 */
export function seatPositions(
  o: Pick<SeatingObject, "kind" | "width" | "height" | "seatCount" | "ends">,
) {
  const n = o.seatCount;
  const off = SEAT_SIZE / 2 + SEAT_GAP;
  const w = o.width;
  const h = o.height;

  switch (o.kind) {
    case "round": {
      const r = w / 2 + off;
      // start at the top and go clockwise
      return Array.from({ length: n }, (_, i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        return { x: Math.cos(a) * r, y: Math.sin(a) * r };
      });
    }
    case "rect": {
      const side = banquetSideSeats(n, o.ends);
      const top = Math.ceil(side / 2);
      const bottom = side - top;
      const seats = along(top, w, -h / 2 - off, true);
      if (o.ends && n >= 2) seats.push({ x: w / 2 + off, y: 0 });
      // bottom side runs right-to-left so the order continues around the table
      seats.push(...along(bottom, w, h / 2 + off, true).reverse());
      if (o.ends && n >= 2) seats.push({ x: -w / 2 - off, y: 0 });
      return seats;
    }
    case "square": {
      // top, right, bottom, left in turn, then spread along each side
      const counts = [0, 0, 0, 0];
      for (let i = 0; i < n; i++) counts[i % 4]++;
      return [
        ...along(counts[0], w, -h / 2 - off, true),
        ...along(counts[1], h, w / 2 + off, false),
        ...along(counts[2], w, h / 2 + off, true).reverse(),
        ...along(counts[3], h, -w / 2 - off, false).reverse(),
      ];
    }
    case "head":
    case "sweetheart":
      // everyone on one side, facing the room
      return along(n, w, -h / 2 - off, true);
    default:
      return [];
  }
}

/** Rotates a point (relative to a table's centre) and moves it into room coordinates. */
export function toRoom(
  o: Pick<SeatingObject, "x" | "y" | "rotation">,
  p: { x: number; y: number },
) {
  const a = (o.rotation * Math.PI) / 180;
  return {
    x: o.x + p.x * Math.cos(a) - p.y * Math.sin(a),
    y: o.y + p.x * Math.sin(a) + p.y * Math.cos(a),
  };
}

/** Initials for a seat: "Ann Smith" → "AS". */
export function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** "Table 3", "Paris", or "Paris (3)". */
export function tableName(o: Pick<SeatingObject, "label" | "number" | "kind">) {
  if (o.label && o.number != null) return `${o.label} (${o.number})`;
  if (o.label) return o.label;
  if (o.number != null) return `Table ${o.number}`;
  return KINDS[o.kind].label;
}
