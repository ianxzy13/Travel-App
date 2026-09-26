"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Heart, MessageCircle } from "lucide-react";
import type { PinView } from "@/lib/inspiration/load";
import { cn } from "@/lib/utils";
import { PinImage } from "./pin-image";

export const STATUS_LABEL = { love: "Love it", maybe: "Maybe" } as const;

/**
 * One tile in the grid. Click (or Enter) opens it; editors can also drag it
 * with a mouse, or long-press on a phone, onto another pin or a board.
 */
export function PinCard({
  pin,
  canDrag,
  hearted,
  onOpen,
}: {
  pin: PinView;
  canDrag: boolean;
  hearted: boolean;
  onOpen: () => void;
}) {
  const drag = useDraggable({ id: `pin:${pin.id}`, disabled: !canDrag });
  const drop = useDroppable({ id: `pin:${pin.id}`, disabled: !canDrag });
  // Keyboard users open the pin instead (moving is in the pin's details).
  const pointer = { ...drag.listeners };
  delete pointer.onKeyDown;
  const label = pin.title || "Untitled pin";

  return (
    <div
      ref={(el) => {
        drag.setNodeRef(el);
        drop.setNodeRef(el);
      }}
      {...pointer}
      className={cn(
        "group relative touch-manipulation rounded-xl transition-opacity select-none [-webkit-touch-callout:none]",
        drag.isDragging && "opacity-40",
        drop.isOver && !drag.isDragging && "ring-primary ring-2 ring-offset-2",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="focus-visible:ring-ring block w-full overflow-hidden rounded-xl text-left focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        aria-label={`Open ${label}`}
      >
        <PinImage
          src={pin.src}
          alt={label}
          width={pin.width}
          height={pin.height}
          className="transition-transform duration-300 group-hover:scale-[1.02]"
        />
        {pin.status && (
          <span
            className={cn(
              "absolute top-2 left-2 rounded-full px-2 py-0.5 text-xs font-medium shadow-sm",
              pin.status === "love" ? "bg-primary text-primary-foreground" : "bg-card text-foreground",
            )}
          >
            {STATUS_LABEL[pin.status]}
          </span>
        )}
      </button>
      <div className="mt-1.5 flex items-start justify-between gap-2 px-0.5 text-sm">
        <p className={cn("line-clamp-2 min-w-0", !pin.title && "text-muted-foreground")}>{pin.title || "Untitled"}</p>
        <div className="text-muted-foreground flex shrink-0 items-center gap-2 text-xs">
          {pin.hearts.length > 0 && (
            <span className="flex items-center gap-0.5" aria-label={`${pin.hearts.length} hearts`}>
              <Heart className={cn("size-3.5", hearted && "fill-primary text-primary")} aria-hidden />
              {pin.hearts.length}
            </span>
          )}
          {pin.comments.length > 0 && (
            <span className="flex items-center gap-0.5" aria-label={`${pin.comments.length} comments`}>
              <MessageCircle className="size-3.5" aria-hidden />
              {pin.comments.length}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
