/* eslint-disable @next/next/no-img-element -- pins come from any website, so next/image can't list the hosts */
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

export const UNSPLASH_LINK =
  "https://unsplash.com/?utm_source=vow_wedding_planner&utm_medium=referral";

/** Unsplash images can be resized by adding ?w=…; other images are used as-is. */
export function sized(src: string, width: number) {
  if (
    !src.startsWith("https://images.unsplash.com/") &&
    !src.startsWith("https://plus.unsplash.com/")
  )
    return src;
  const url = new URL(src);
  url.searchParams.set("w", String(width));
  url.searchParams.set("auto", "format");
  url.searchParams.set("q", "75");
  return url.toString();
}

/** A pin's picture, keeping its shape before it loads so the grid doesn't jump. */
export function PinImage({
  src,
  alt,
  width,
  height,
  size = 600,
  className,
  fit = "cover",
}: {
  src: string | null;
  alt: string;
  width: number | null;
  height: number | null;
  size?: number;
  className?: string;
  fit?: "cover" | "contain";
}) {
  const ratio = width && height ? `${width} / ${height}` : "4 / 5";
  if (!src) {
    return (
      <div
        className={cn("bg-muted text-muted-foreground flex items-center justify-center", className)}
        style={{ aspectRatio: ratio }}
        role="img"
        aria-label={`${alt} (image unavailable)`}
      >
        <ImageOff className="size-6" aria-hidden />
      </div>
    );
  }
  return (
    <img
      src={sized(src, size)}
      alt={alt}
      loading="lazy"
      decoding="async"
      draggable={false}
      referrerPolicy="no-referrer"
      className={cn(
        "bg-muted block w-full",
        fit === "cover" ? "object-cover" : "object-contain",
        className,
      )}
      style={fit === "cover" ? { aspectRatio: ratio } : undefined}
    />
  );
}
