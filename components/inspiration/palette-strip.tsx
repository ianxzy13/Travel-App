"use client";

import { useTransition } from "react";
import { Copy, X } from "lucide-react";
import { toast } from "sonner";
import { removePaletteColor } from "@/app/app/inspiration/actions";
import { textOn } from "@/lib/inspiration/layout";
import { cn } from "@/lib/utils";

/** The wedding's saved colours. Click a swatch to copy its hex code. */
export function PaletteStrip({
  colors,
  canEdit,
  size = "md",
}: {
  colors: { id: string; hex: string }[];
  canEdit: boolean;
  size?: "sm" | "md";
}) {
  const [pending, startTransition] = useTransition();
  if (!colors.length) return null;
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Wedding colour palette">
      {colors.map((c) => (
        <li key={c.id} className="group relative">
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(c.hex).then(() => toast.success(`Copied ${c.hex}`))}
            className={cn(
              "focus-visible:ring-ring flex items-end justify-center rounded-lg border shadow-sm focus-visible:ring-2 focus-visible:outline-none",
              size === "md" ? "h-14 w-16 pb-1" : "size-8",
            )}
            style={{ background: c.hex, color: textOn(c.hex) }}
            aria-label={`Colour ${c.hex}, copy`}
            title={c.hex}
          >
            {size === "md" && (
              <span className="flex items-center gap-0.5 font-mono text-[0.65rem]">
                <Copy className="size-2.5 opacity-0 group-hover:opacity-70" aria-hidden />
                {c.hex}
              </span>
            )}
          </button>
          {canEdit && size === "md" && (
            <button
              type="button"
              disabled={pending}
              onClick={() => startTransition(async () => { const r = await removePaletteColor(c.id); if (!r.ok) toast.error(r.error); })}
              className="bg-card focus-visible:ring-ring absolute -top-1.5 -right-1.5 hidden rounded-full border p-0.5 shadow group-hover:block focus-visible:block focus-visible:ring-2 focus-visible:outline-none"
              aria-label={`Remove ${c.hex} from palette`}
            >
              <X className="size-3" aria-hidden />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
