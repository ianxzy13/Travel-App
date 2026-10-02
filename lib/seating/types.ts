import type { AgeGroup, GuestSide, RelationshipType, RsvpStatus } from "@/lib/database.types";

/** Everything that can be placed on the floor plan. */
export type SeatingKind =
  | "round"
  | "rect"
  | "square"
  | "head"
  | "sweetheart"
  | "dance_floor"
  | "stage"
  | "bar"
  | "buffet"
  | "cake"
  | "entrance"
  | "pillar"
  | "label";

/**
 * A table or decor item. Positions and sizes are in centimetres in the room;
 * (x, y) is the centre and rotation is in degrees.
 */
export type SeatingObject = {
  id: string;
  kind: SeatingKind;
  label: string | null;
  number: number | null;
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
  seatCount: number;
  /** banquet tables: one seat at each short end */
  ends: boolean;
};

/** "This guest sits at seat N of this table" (seats are numbered from 0). */
export type Assignment = { guestId: string; objectId: string; seatIndex: number };

export type Room = { width: number; height: number };

/** The editable state of one event's floor plan. */
export type SeatingState = {
  room: Room;
  objects: Record<string, SeatingObject>;
  /** keyed by guest id: a guest can sit in only one seat */
  assignments: Record<string, Assignment>;
};

/** A guest as the seating chart sees them. */
export type SeatingGuest = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  householdId: string;
  householdName: string;
  side: GuestSide;
  ageGroup: AgeGroup;
  tagIds: string[];
  dietary: string | null;
  accessibility: string | null;
  plusOneOf: string | null;
  languages: string[];
  /** answer for THIS event (null = no reply yet) */
  rsvp: RsvpStatus | null;
  mealOptionId: string | null;
};

export type SeatingRelationship = { guestA: string; guestB: string; type: RelationshipType };
