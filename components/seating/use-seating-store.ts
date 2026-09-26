"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { saveSeatingChanges } from "@/app/app/seating/actions";
import type { SeatingObjectRow } from "@/lib/database.types";
import {
  diffStates,
  isEmptyChanges,
  mergeChanges,
  noChanges,
  toPayload,
  type SeatingChanges,
} from "@/lib/seating/state";
import type { SeatingObject, SeatingState } from "@/lib/seating/types";
import { createClient } from "@/lib/supabase/client";

const HISTORY_LIMIT = 50;
const SAVE_DELAY_MS = 500;
/** Ignore live updates for things we changed ourselves in the last few seconds. */
const ECHO_WINDOW_MS = 4000;

export type SaveStatus = "saved" | "saving" | "retrying" | "error";

/**
 * Holds the seating chart in the browser:
 * - every change produces a new state (see lib/seating/state.ts)
 * - up to 50 earlier states are kept for undo/redo
 * - only the differences are saved, in small batches (autosave)
 * - changes made by collaborators arrive live via Supabase Realtime
 */
export function useSeatingStore(
  layoutId: string,
  initial: SeatingState,
  canEdit: boolean,
  /** replaceable for tests; normally the server action */
  save: typeof saveSeatingChanges = saveSeatingChanges,
) {
  const [state, setStateRaw] = useState(initial);
  const stateRef = useRef(initial);
  /** last state whose changes are saved or queued (previews during a drag are not) */
  const committed = useRef(initial);
  const past = useRef<SeatingState[]>([]);
  const future = useRef<SeatingState[]>([]);
  const [historySize, setHistorySize] = useState({ past: 0, future: 0 });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");

  const pending = useRef<SeatingChanges>(noChanges());
  const saving = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retries = useRef(0);
  const touched = useRef(new Map<string, number>());

  const setState = useCallback((next: SeatingState) => {
    stateRef.current = next;
    setStateRaw(next);
  }, []);

  const syncHistory = () =>
    setHistorySize({ past: past.current.length, future: future.current.length });

  // ---------- saving ----------

  const flush = useCallback(async () => {
    if (saving.current || isEmptyChanges(pending.current)) return;
    const batch = pending.current;
    pending.current = noChanges();
    saving.current = true;
    setSaveStatus("saving");

    const result = await save(layoutId, toPayload(batch)).catch(() => ({
      ok: false as const,
      error: "You seem to be offline. Retrying…",
      retry: true,
    }));
    saving.current = false;

    if (result.ok) {
      retries.current = 0;
      if (isEmptyChanges(pending.current)) setSaveStatus("saved");
      else void flush();
      return;
    }
    if ("retry" in result && result.retry && retries.current < 5) {
      // Put the batch back underneath anything newer, and try again shortly.
      pending.current = mergeChanges(batch, pending.current);
      retries.current++;
      setSaveStatus("retrying");
      timer.current = setTimeout(() => void flush(), 2000 * retries.current);
      return;
    }
    setSaveStatus("error");
    toast.error(result.error);
    // The server state is the truth now: reload it.
    setTimeout(() => window.location.reload(), 1500);
  }, [layoutId, save]);

  const queueSave = useCallback(
    (changes: SeatingChanges) => {
      if (isEmptyChanges(changes)) return;
      const now = Date.now();
      for (const id of Object.keys(changes.objects)) touched.current.set(`o:${id}`, now);
      for (const g of Object.keys(changes.assignments)) touched.current.set(`a:${g}`, now);
      if (changes.room) touched.current.set("room", now);
      pending.current = mergeChanges(pending.current, changes);
      setSaveStatus("saving");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
    },
    [flush],
  );

  // ---------- changes, undo, redo ----------

  /**
   * Apply a change. `base` is the state before a live drag started, so the
   * whole drag becomes ONE undo step.
   */
  const commit = useCallback(
    (next: SeatingState, base?: SeatingState) => {
      if (!canEdit) return;
      const before = base ?? committed.current;
      if (next === before) return;
      past.current = [...past.current, before].slice(-HISTORY_LIMIT);
      future.current = [];
      syncHistory();
      queueSave(diffStates(committed.current, next));
      committed.current = next;
      setState(next);
    },
    [canEdit, queueSave, setState],
  );

  /** Show a change immediately without saving (e.g. while dragging a table). */
  const preview = useCallback((next: SeatingState) => setState(next), [setState]);

  const undo = useCallback(() => {
    const prev = past.current.at(-1);
    if (!prev || !canEdit) return;
    past.current = past.current.slice(0, -1);
    future.current = [committed.current, ...future.current];
    syncHistory();
    queueSave(diffStates(committed.current, prev));
    committed.current = prev;
    setState(prev);
  }, [canEdit, queueSave, setState]);

  const redo = useCallback(() => {
    const next = future.current[0];
    if (!next || !canEdit) return;
    future.current = future.current.slice(1);
    past.current = [...past.current, committed.current];
    syncHistory();
    queueSave(diffStates(committed.current, next));
    committed.current = next;
    setState(next);
  }, [canEdit, queueSave, setState]);

  // ---------- live updates from collaborators ----------

  useEffect(() => {
    const supabase = createClient();
    const recent = (key: string) => Date.now() - (touched.current.get(key) ?? 0) < ECHO_WINDOW_MS;
    // Remote changes are already saved: apply them to both the saved and shown state.
    const update = (fn: (s: SeatingState) => SeatingState) => {
      committed.current = fn(committed.current);
      setState(fn(stateRef.current));
    };

    const channel = supabase
      .channel(`seating:${layoutId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "seating_objects",
          filter: `layout_id=eq.${layoutId}`,
        },
        (p) => {
          if (p.eventType === "DELETE") return;
          const row = p.new as SeatingObjectRow;
          if (recent(`o:${row.id}`)) return;
          const obj: SeatingObject = {
            id: row.id,
            kind: row.kind,
            label: row.label,
            number: row.number,
            x: row.x,
            y: row.y,
            rotation: row.rotation,
            width: row.width,
            height: row.height,
            seatCount: row.seat_count,
            ends: row.ends,
          };
          update((s) => ({ ...s, objects: { ...s.objects, [obj.id]: obj } }));
        },
      )
      // Deletes can't be filtered by layout; we get the id and ignore unknown ones.
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "seating_objects" },
        (p) => {
          const id = (p.old as { id?: string }).id;
          if (!id || recent(`o:${id}`) || !stateRef.current.objects[id]) return;
          update((s) => {
            const objects = { ...s.objects };
            delete objects[id];
            const assignments = Object.fromEntries(
              Object.entries(s.assignments).filter(([, a]) => a.objectId !== id),
            );
            return { ...s, objects, assignments };
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "seat_assignments",
          filter: `layout_id=eq.${layoutId}`,
        },
        (p) => {
          if (p.eventType === "DELETE") return;
          const row = p.new as { guest_id: string; object_id: string; seat_index: number };
          if (recent(`a:${row.guest_id}`)) return;
          update((s) => {
            // a live move can push out whoever we had in that seat
            const assignments = Object.fromEntries(
              Object.entries(s.assignments).filter(
                ([g, a]) =>
                  g === row.guest_id ||
                  a.objectId !== row.object_id ||
                  a.seatIndex !== row.seat_index,
              ),
            );
            assignments[row.guest_id] = {
              guestId: row.guest_id,
              objectId: row.object_id,
              seatIndex: row.seat_index,
            };
            return { ...s, assignments };
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "seat_assignments" },
        (p) => {
          const old = p.old as { layout_id?: string; guest_id?: string };
          if (old.layout_id !== layoutId || !old.guest_id || recent(`a:${old.guest_id}`)) return;
          update((s) => {
            const assignments = { ...s.assignments };
            delete assignments[old.guest_id!];
            return { ...s, assignments };
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "seating_layouts",
          filter: `id=eq.${layoutId}`,
        },
        (p) => {
          if (recent("room")) return;
          const row = p.new as { room_width: number; room_height: number };
          update((s) => ({ ...s, room: { width: row.room_width, height: row.room_height } }));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [layoutId, setState]);

  // Warn before closing the tab with unsaved changes; save when hidden.
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (!isEmptyChanges(pending.current) || saving.current) e.preventDefault();
    };
    const hidden = () => document.visibilityState === "hidden" && void flush();
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [flush]);

  return {
    state,
    stateRef,
    commit,
    preview,
    undo,
    redo,
    canUndo: historySize.past > 0,
    canRedo: historySize.future > 0,
    saveStatus,
  };
}
