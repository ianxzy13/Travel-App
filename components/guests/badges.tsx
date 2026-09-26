import type { GuestSide, TagColor } from "@/lib/database.types";
import { cn } from "@/lib/utils";

/** Tailwind classes per tag colour (light + dark). */
export const TAG_COLOR_CLASSES: Record<TagColor, string> = {
  stone: "bg-stone-100 text-stone-800 dark:bg-stone-800 dark:text-stone-100",
  rose: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-100",
  sage: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-100",
  sky: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-100",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-100",
  violet: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-100",
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
        side === "partner_b" && "bg-sky-500",
        side === "both" && "bg-stone-400",
      )}
    />
  );
}
