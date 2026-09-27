"use client";

import { SortableContext, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { BoardView } from "@/lib/inspiration/load";
import { cn } from "@/lib/utils";

const chip =
  "focus-visible:ring-ring flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-none";

/**
 * The row of boards. Editors reorder boards with the grip (mouse, touch or
 * keyboard: focus the grip, press Space, use the arrow keys, Space again).
 * Pins can be dropped onto a board to move them there.
 */
export function BoardBar({
  boards,
  selected,
  total,
  canEdit,
  onSelect,
  onNew,
}: {
  boards: BoardView[];
  selected: string;
  total: number;
  canEdit: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  const t = useTranslations("inspiration");
  return (
    <nav aria-label={t("boards")} className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      <ul className="flex items-center gap-2">
        <li>
          <button
            type="button"
            onClick={() => onSelect("all")}
            aria-current={selected === "all" ? "page" : undefined}
            className={cn(
              chip,
              selected === "all"
                ? "bg-primary text-primary-foreground border-primary"
                : "hover:bg-accent",
            )}
          >
            {t("allPins")}{" "}
            <span className={selected === "all" ? undefined : "text-muted-foreground"}>
              {total}
            </span>
          </button>
        </li>
        <SortableContext
          items={boards.map((b) => `board:${b.id}`)}
          strategy={horizontalListSortingStrategy}
        >
          {boards.map((b) => (
            <BoardChip
              key={b.id}
              board={b}
              active={selected === b.id}
              canEdit={canEdit}
              onSelect={() => onSelect(b.id)}
            />
          ))}
        </SortableContext>
        {canEdit && (
          <li>
            <Button variant="ghost" size="sm" onClick={onNew} className="rounded-full">
              <Plus aria-hidden /> {t("newBoard")}
            </Button>
          </li>
        )}
      </ul>
    </nav>
  );
}

function BoardChip({
  board,
  active,
  canEdit,
  onSelect,
}: {
  board: BoardView;
  active: boolean;
  canEdit: boolean;
  onSelect: () => void;
}) {
  const t = useTranslations("inspiration");
  const s = useSortable({ id: `board:${board.id}`, disabled: !canEdit });
  // Only pins count as "dropping onto" a board (not other boards being sorted).
  const pinOver = s.isOver && String(s.active?.id).startsWith("pin:");

  return (
    <li
      ref={s.setNodeRef}
      style={{ transform: CSS.Translate.toString(s.transform), transition: s.transition }}
      className={cn(
        "flex items-center rounded-full",
        s.isDragging && "z-10 opacity-70",
        pinOver && "ring-primary ring-2 ring-offset-2",
      )}
    >
      {canEdit && (
        <button
          type="button"
          ref={s.setActivatorNodeRef}
          {...s.attributes}
          {...s.listeners}
          aria-label={t("reorder", { name: board.name })}
          className={cn(
            "focus-visible:ring-ring relative z-10 -me-7 flex h-9 w-7 cursor-grab touch-none items-center justify-end rounded-s-full pe-0.5 focus-visible:ring-2 focus-visible:outline-none",
            active ? "text-primary-foreground/80" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <GripVertical className="size-3.5" aria-hidden />
        </button>
      )}
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? "page" : undefined}
        className={cn(
          chip,
          canEdit && "ps-7",
          active ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent",
        )}
      >
        {board.name}{" "}
        <span className={active ? undefined : "text-muted-foreground"}>{board.count}</span>
      </button>
    </li>
  );
}
