"use client";

import { useEffect, useRef, useState } from "react";
import { Site } from "@/components/website/site";
import type { SiteData } from "@/lib/website/content";

const WIDTH = { desktop: 1280, phone: 390 } as const;

/**
 * Live preview. The site is drawn at a real screen width (1280 px desktop or
 * 390 px phone) and scaled down to fit, so it looks exactly like the real thing.
 */
export function SitePreview({
  data,
  device,
  fontClass,
}: {
  data: SiteData;
  device: "desktop" | "phone";
  fontClass: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setSize({ w: e.contentRect.width, h: e.contentRect.height }),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const width = WIDTH[device];
  const scale = size.w ? Math.min(1, size.w / width) : 1;
  const frameWidth = width * scale;

  return (
    <div ref={box} className="flex h-full justify-center overflow-hidden">
      {size.w > 0 && (
        <div
          className={
            device === "phone"
              ? "overflow-hidden rounded-[2rem] border-8 border-neutral-800 shadow-xl"
              : "overflow-hidden rounded-lg border shadow-sm"
          }
          style={{ width: frameWidth + (device === "phone" ? 16 : 2), height: size.h }}
        >
          <div
            className={fontClass}
            style={{
              width,
              height: size.h / scale - (device === "phone" ? 16 / scale : 0),
              transform: `scale(${scale})`,
              transformOrigin: "0 0",
              overflowY: "auto",
            }}
            aria-label="Website preview"
            role="region"
            tabIndex={0}
          >
            <Site data={data} preview />
          </div>
        </div>
      )}
    </div>
  );
}
