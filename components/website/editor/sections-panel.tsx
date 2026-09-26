"use client";

import { useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, GripVertical } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { SECTION_HINT, SECTION_LABEL, isSectionEmpty, type Section, type SiteData } from "@/lib/website/content";
import { cn } from "@/lib/utils";
import { SectionForm } from "./section-forms";

type Props = {
  sections: Section[];
  onChange: (sections: Section[]) => void;
  site: Pick<SiteData, "events" | "hotels" | "wedding">;
  weddingId: string;
  images: Record<string, string>;
  addImage: (path: string, url: string) => void;
  disabled: boolean;
};

/**
 * Sections in page order. Drag the grip (or focus it and use Space + arrow
 * keys) to reorder; the switch shows/hides a section; click a name to edit it.
 * "Home" always stays at the top.
 */
export function SectionsPanel({ sections, onChange, site, ...common }: Props) {
  const [open, setOpen] = useState<string | null>("home");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const home = sections.find((s) => s.kind === "home");
  const rest = sections.filter((s) => s.kind !== "home");

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = rest.findIndex((s) => s.id === active.id);
    const to = rest.findIndex((s) => s.id === over.id);
    onChange([...(home ? [home] : []), ...arrayMove(rest, from, to)]);
  }

  const update = (next: Section) => onChange(sections.map((s) => (s.id === next.id ? next : s)));
  const row = (s: Section, sortable: boolean) => (
    <SectionRow
      key={s.id}
      section={s}
      sortable={sortable && !common.disabled}
      disabled={common.disabled}
      open={open === s.id}
      empty={isSectionEmpty(s, site)}
      onToggleOpen={() => setOpen(open === s.id ? null : s.id)}
      onChange={update}
    >
      <SectionForm
        section={s}
        onChange={(content) => update({ ...s, content } as Section)}
        eventCount={site.events.length}
        hotelCount={site.hotels.length}
        {...common}
      />
    </SectionRow>
  );

  return (
    <div className="space-y-2">
      {home && <ul>{row(home, false)}</ul>}
      <DndContext id="website-sections" sensors={sensors} collisionDetection={closestCenter} onDragStart={() => setOpen(null)} onDragEnd={onDragEnd}>
        <SortableContext items={rest.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">{rest.map((s) => row(s, true))}</ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SectionRow({
  section,
  sortable,
  disabled,
  open,
  empty,
  onToggleOpen,
  onChange,
  children,
}: {
  section: Section;
  sortable: boolean;
  disabled: boolean;
  open: boolean;
  empty: boolean;
  onToggleOpen: () => void;
  onChange: (s: Section) => void;
  children: React.ReactNode;
}) {
  const s = useSortable({ id: section.id, disabled: !sortable });
  // (the open section is closed when a drag starts, so every row is small and easy to move)
  const label = SECTION_LABEL[section.kind];
  const panelId = `section-panel-${section.kind}`;
  return (
    <li
      ref={s.setNodeRef}
      style={{ transform: CSS.Translate.toString(s.transform), transition: s.transition }}
      className={cn("bg-card rounded-xl border", s.isDragging && "relative z-10 shadow-lg")}
    >
      <div className="flex items-center gap-1 p-2">
        {sortable ? (
          <button
            type="button"
            ref={s.setActivatorNodeRef}
            {...s.attributes}
            {...s.listeners}
            aria-label={`Reorder ${label}`}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring flex size-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-md focus-visible:ring-2 focus-visible:outline-none"
          >
            <GripVertical className="size-4" aria-hidden />
          </button>
        ) : (
          <span className="size-8 shrink-0" />
        )}
        <button
          type="button"
          onClick={onToggleOpen}
          aria-expanded={open}
          aria-controls={panelId}
          className="focus-visible:ring-ring flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left focus-visible:ring-2 focus-visible:outline-none"
        >
          <span className="min-w-0 flex-1">
            <span className={cn("block font-medium", !section.visible && "text-muted-foreground line-through")}>{label}</span>
            <span className="text-muted-foreground block truncate text-xs">
              {section.visible && empty ? "Hidden until it has content" : SECTION_HINT[section.kind]}
            </span>
          </span>
          <ChevronDown className={cn("text-muted-foreground size-4 shrink-0 transition-transform", open && "rotate-180")} aria-hidden />
        </button>
        {section.kind !== "home" && (
          <Switch
            checked={section.visible}
            disabled={disabled}
            onCheckedChange={(visible) => onChange({ ...section, visible })}
            aria-label={`Show ${label} on the website`}
          />
        )}
      </div>
      {open && (
        <div id={panelId} className="border-t p-4">
          {children}
        </div>
      )}
    </li>
  );
}
