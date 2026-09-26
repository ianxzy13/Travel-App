"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** 1–5 stars. Read-only when `onChange` is missing. Clicking the current value clears it. */
export function StarRating({
  value,
  onChange,
  size = "size-5",
  label = "Rating",
}: {
  value: number | null;
  onChange?: (v: number | null) => void;
  size?: string;
  label?: string;
}) {
  if (!onChange) {
    return (
      <span className="inline-flex" role="img" aria-label={value ? `${value} out of 5 stars` : "Not rated"}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} className={cn(size, n <= (value ?? 0) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")} aria-hidden />
        ))}
      </span>
    );
  }
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          onClick={() => onChange(value === n ? null : n)}
          className="focus-visible:ring-ring rounded p-0.5 focus-visible:ring-2 focus-visible:outline-none"
        >
          <Star className={cn(size, n <= (value ?? 0) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/50")} aria-hidden />
        </button>
      ))}
    </div>
  );
}
