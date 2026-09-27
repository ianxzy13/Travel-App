"use client";

import { useEffect, useRef, useState } from "react";
import { masonryColumns } from "@/lib/inspiration/layout";

/**
 * Pinterest-style grid: 2 columns on phones up to 5 on wide screens.
 * Items render in batches as you scroll (infinite scroll).
 */
export function Masonry<T extends { id: string; width: number | null; height: number | null }>({
  items,
  render,
  batch = 30,
}: {
  items: T[];
  render: (item: T, index: number) => React.ReactNode;
  batch?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(3);
  const [shown, setShown] = useState(batch);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const w = e.contentRect.width;
      setCols(w < 520 ? 2 : w < 820 ? 3 : w < 1150 ? 4 : 5);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Load the next batch when the bottom comes into view.
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setShown((s) => s + batch), {
      rootMargin: "800px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [batch]);

  const visible = items.slice(0, shown);
  const index = new Map(items.map((it, i) => [it.id, i]));
  return (
    <div ref={ref}>
      <div className="flex items-start gap-3">
        {masonryColumns(visible, cols).map((col, c) => (
          <div key={c} className="flex min-w-0 flex-1 flex-col gap-3">
            {col.map((item) => render(item, index.get(item.id)!))}
          </div>
        ))}
      </div>
      {shown < items.length && <div ref={sentinel} className="h-10" aria-hidden />}
    </div>
  );
}
