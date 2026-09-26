"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Copy,
  Minus,
  MoveRight,
  Plus,
  RotateCcw,
  RotateCw,
  Trash2,
  UserMinus,
} from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { isTable, KINDS, tableName } from "@/lib/seating/geometry";
import type { TableIssue } from "@/lib/seating/rules";
import type { Room, SeatingGuest, SeatingObject, SeatingState } from "@/lib/seating/types";

type Props = {
  state: SeatingState;
  selectedId: string | null;
  selectedSeat: { objectId: string; seatIndex: number } | null;
  guestsById: Map<string, SeatingGuest>;
  mealLookup: Map<string, string>;
  issues: TableIssue[];
  canEdit: boolean;
  snap: boolean;
  onSnapChange: (v: boolean) => void;
  onChange: (id: string, patch: Partial<SeatingObject>) => void;
  onRoomChange: (room: Room) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onUnseat: (guestIds: string[]) => void;
  onMoveGuest: (guest: SeatingGuest) => void;
};

/** Settings for whatever is selected (or the room when nothing is). */
export function Inspector(props: Props) {
  const { state, selectedId, selectedSeat } = props;
  const object = selectedId ? state.objects[selectedId] : null;

  if (selectedSeat) {
    const guestId = Object.values(state.assignments).find(
      (a) => a.objectId === selectedSeat.objectId && a.seatIndex === selectedSeat.seatIndex,
    )?.guestId;
    const guest = guestId ? props.guestsById.get(guestId) : undefined;
    const table = state.objects[selectedSeat.objectId];
    if (guest && table)
      return <SeatCard guest={guest} table={table} seatIndex={selectedSeat.seatIndex} {...props} />;
  }
  if (!object) return <RoomCard {...props} />;
  return <ObjectCard key={object.id} object={object} {...props} />;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card h-full space-y-4 overflow-y-auto rounded-xl border p-4">
      <h2 className="font-serif text-2xl">{title}</h2>
      {children}
    </div>
  );
}

function RoomCard({ state, canEdit, snap, onSnapChange, onRoomChange }: Props) {
  const [w, setW] = useState(String(state.room.width / 100));
  const [h, setH] = useState(String(state.room.height / 100));
  const save = () => {
    const width = Math.round(Math.min(200, Math.max(3, Number(w) || 0)) * 100);
    const height = Math.round(Math.min(200, Math.max(3, Number(h) || 0)) * 100);
    setW(String(width / 100));
    setH(String(height / 100));
    if (width !== state.room.width || height !== state.room.height) onRoomChange({ width, height });
  };
  return (
    <Panel title="Room">
      <p className="text-muted-foreground text-sm">
        Select a table to edit it. Tap the empty floor to come back here.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="room-w">Width (m)</Label>
          <Input
            id="room-w"
            inputMode="decimal"
            value={w}
            disabled={!canEdit}
            onChange={(e) => setW(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => e.key === "Enter" && save()}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="room-h">Length (m)</Label>
          <Input
            id="room-h"
            inputMode="decimal"
            value={h}
            disabled={!canEdit}
            onChange={(e) => setH(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => e.key === "Enter" && save()}
          />
        </div>
      </div>
      <Label className="justify-between font-normal">
        Snap to grid (50 cm)
        <Switch checked={snap} onCheckedChange={onSnapChange} />
      </Label>
      <div className="text-muted-foreground space-y-1 border-t pt-4 text-xs">
        <p className="text-foreground font-medium">Shortcuts</p>
        <p>Arrow keys: move · R: rotate · Ctrl+D: duplicate · Delete: remove</p>
        <p>Ctrl+Z / Ctrl+Y: undo / redo · Esc: cancel</p>
        <p>Scroll or pinch to zoom · drag the empty floor to move around</p>
      </div>
    </Panel>
  );
}

function ObjectCard({
  object: o,
  state,
  issues,
  canEdit,
  guestsById,
  onChange,
  onDelete,
  onDuplicate,
  onUnseat,
  onMoveGuest,
}: Props & { object: SeatingObject }) {
  const info = KINDS[o.kind];
  const table = isTable(o.kind);
  const [label, setLabel] = useState(o.label ?? "");
  const [number, setNumber] = useState(o.number?.toString() ?? "");
  const seated = Object.values(state.assignments)
    .filter((a) => a.objectId === o.id)
    .sort((a, b) => a.seatIndex - b.seatIndex)
    .map((a) => guestsById.get(a.guestId))
    .filter((g): g is SeatingGuest => !!g);

  const saveLabel = () => {
    const v = label.trim().slice(0, 60) || null;
    if (v !== o.label) onChange(o.id, { label: v });
  };
  const saveNumber = () => {
    const n = number.trim() === "" ? null : Math.max(0, Math.min(999, Math.round(Number(number))));
    if (Number.isNaN(n)) return setNumber(o.number?.toString() ?? "");
    if (n !== o.number) onChange(o.id, { number: n });
  };
  const rotate = (by: number) =>
    onChange(o.id, { rotation: (((o.rotation + by) % 360) + 360) % 360 });

  return (
    <Panel title={tableName(o)}>
      <p className="text-muted-foreground -mt-2 text-sm">{info.label}</p>

      {issues.length > 0 && (
        <ul className="bg-destructive/10 space-y-1 rounded-lg p-3 text-sm">
          {issues.map((i, n) => (
            <li key={n} className="flex gap-2">
              <AlertTriangle className="text-destructive mt-0.5 size-4 shrink-0" aria-hidden />
              {i.message}
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-[1fr_5rem] gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="obj-label">{table ? "Name (optional)" : "Label"}</Label>
          <Input
            id="obj-label"
            value={label}
            maxLength={60}
            disabled={!canEdit}
            placeholder={table ? "e.g. Paris" : ""}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={saveLabel}
            onKeyDown={(e) => e.key === "Enter" && saveLabel()}
          />
        </div>
        {table && (
          <div className="space-y-1.5">
            <Label htmlFor="obj-number">Number</Label>
            <Input
              id="obj-number"
              inputMode="numeric"
              value={number}
              disabled={!canEdit}
              onChange={(e) => setNumber(e.target.value.replace(/\D/g, ""))}
              onBlur={saveNumber}
              onKeyDown={(e) => e.key === "Enter" && saveNumber()}
            />
          </div>
        )}
      </div>

      {table && info.maxSeats > info.minSeats && (
        <div className="space-y-1.5">
          <Label>Seats</Label>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={!canEdit || o.seatCount <= info.minSeats}
              onClick={() => onChange(o.id, { seatCount: o.seatCount - 1 })}
              aria-label="One seat fewer"
            >
              <Minus aria-hidden />
            </Button>
            <span className="w-8 text-center font-medium tabular-nums" aria-live="polite">
              {o.seatCount}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={!canEdit || o.seatCount >= info.maxSeats}
              onClick={() => onChange(o.id, { seatCount: o.seatCount + 1 })}
              aria-label="One seat more"
            >
              <Plus aria-hidden />
            </Button>
          </div>
          {o.kind === "rect" && (
            <Label className="mt-2 font-normal">
              <Checkbox
                checked={o.ends}
                disabled={!canEdit || o.seatCount < 4}
                onCheckedChange={(v) => onChange(o.id, { ends: v === true })}
              />
              A seat at each end
            </Label>
          )}
        </div>
      )}

      {!table && o.kind !== "pillar" && (
        <div className="grid grid-cols-2 gap-3">
          <SizeInput
            label="Width (cm)"
            value={o.width}
            disabled={!canEdit}
            onCommit={(width) => onChange(o.id, { width })}
          />
          <SizeInput
            label="Depth (cm)"
            value={o.height}
            disabled={!canEdit}
            onCommit={(height) => onChange(o.id, { height })}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label>Rotation</Label>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            disabled={!canEdit}
            onClick={() => rotate(-15)}
            aria-label="Rotate 15° left"
          >
            <RotateCcw aria-hidden />
          </Button>
          <span className="w-12 text-center text-sm tabular-nums">{Math.round(o.rotation)}°</span>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={!canEdit}
            onClick={() => rotate(15)}
            aria-label="Rotate 15° right"
          >
            <RotateCw aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={!canEdit || o.rotation === 0}
            onClick={() => onChange(o.id, { rotation: 0 })}
          >
            Reset
          </Button>
        </div>
      </div>

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => onDuplicate(o.id)}>
            <Copy aria-hidden /> Duplicate
          </Button>
          <ConfirmDialog
            trigger={
              <Button variant="outline" size="sm" className="text-destructive">
                <Trash2 aria-hidden /> Delete
              </Button>
            }
            title={`Delete ${tableName(o)}?`}
            description={
              seated.length
                ? `${seated.length} guest(s) sitting here will be unseated. You can undo this.`
                : "You can undo this."
            }
            onConfirm={() => onDelete(o.id)}
          />
        </div>
      )}

      {table && (
        <div className="space-y-2 border-t pt-4">
          <p className="text-sm font-medium">
            Seated here ({seated.length}/{o.seatCount})
          </p>
          {seated.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nobody yet. Drag guests onto the seats.</p>
          ) : (
            <ul className="space-y-1">
              {seated.map((g) => (
                <li key={g.id} className="flex items-center gap-1 text-sm">
                  <span className="min-w-0 flex-1 truncate">{g.name}</span>
                  {canEdit && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => onMoveGuest(g)}
                        aria-label={`Move ${g.name}`}
                      >
                        <MoveRight aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => onUnseat([g.id])}
                        aria-label={`Unseat ${g.name}`}
                      >
                        <UserMinus aria-hidden />
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canEdit && seated.length > 1 && (
            <Button variant="ghost" size="sm" onClick={() => onUnseat(seated.map((g) => g.id))}>
              Clear table
            </Button>
          )}
        </div>
      )}
    </Panel>
  );
}

function SizeInput({
  label,
  value,
  disabled,
  onCommit,
}: {
  label: string;
  value: number;
  disabled: boolean;
  onCommit: (v: number) => void;
}) {
  const [v, setV] = useState(String(Math.round(value)));
  const commit = () => {
    const n = Math.max(20, Math.min(5000, Math.round(Number(v) || value)));
    setV(String(n));
    if (n !== Math.round(value)) onCommit(n);
  };
  const id = `size-${label}`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="numeric"
        value={v}
        disabled={disabled}
        onChange={(e) => setV(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
      />
    </div>
  );
}

function SeatCard({
  guest,
  table,
  seatIndex,
  mealLookup,
  canEdit,
  onUnseat,
  onMoveGuest,
}: Props & { guest: SeatingGuest; table: SeatingObject; seatIndex: number }) {
  const meal = guest.mealOptionId ? mealLookup.get(guest.mealOptionId) : null;
  return (
    <Panel title={guest.name}>
      <p className="text-muted-foreground -mt-2 text-sm">
        {tableName(table)} · seat {seatIndex + 1}
      </p>
      <dl className="space-y-2 text-sm">
        <Row label="Household" value={guest.householdName} />
        <Row
          label="RSVP"
          value={
            guest.rsvp === "attending"
              ? "Attending"
              : guest.rsvp === "declined"
                ? "Declined"
                : "No reply yet"
          }
        />
        <Row label="Meal" value={meal ?? "Not chosen"} />
        <Row label="Dietary" value={guest.dietary ?? "None"} />
        {guest.accessibility && <Row label="Accessibility" value={guest.accessibility} />}
        <Row
          label="Age"
          value={
            guest.ageGroup === "adult" ? "Adult" : guest.ageGroup === "child" ? "Child" : "Infant"
          }
        />
      </dl>
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => onMoveGuest(guest)}>
            <MoveRight aria-hidden /> Move
          </Button>
          <Button variant="outline" size="sm" onClick={() => onUnseat([guest.id])}>
            <UserMinus aria-hidden /> Remove from seat
          </Button>
        </div>
      )}
    </Panel>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
