import type { GuestSide, TagColor } from "@/lib/database.types";
import { cn } from "@/lib/utils";

/** Tailwind classes per tag colour (light + dark). */
export const TAG_COLOR_CLASSES: Record<TagColor, string> = {
  stone: "bg-muted text-foreground",
  rose: "bg-tint-blush text-tint-blush-fg",
  sage: "bg-tint-sage text-tint-sage-fg",
  sky: "bg-tint-mist text-tint-mist-fg",
  amber: "bg-tint-sand text-tint-sand-fg",
  violet: "bg-tint-mauve text-tint-mauve-fg",
};

export function TagBadge({
  name,
  color,
  className,
}: {
  name: string;
  color: TagColor;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TAG_COLOR_CLASSES[color],
        className,
      )}
    >
      {name}
    </span>
  );
}

/** Small coloured dot showing whose side a guest is on. */
export function SideDot({ side }: { side: GuestSide }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        side === "partner_a" && "bg-primary",
        side === "partner_b" && "bg-tint-mist-fg",
        side === "both" && "bg-taupe-soft",
      )}
    />
  );
}
