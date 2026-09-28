"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Heart, Lightbulb, Loader2, Pencil, Plus, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createBoard, movePin, reorderBoards, toggleHeart } from "@/app/app/inspiration/actions";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { orderBetween } from "@/lib/inspiration/layout";
import type { BoardView, InspirationData, PinView } from "@/lib/inspiration/load";
import { cn } from "@/lib/utils";
import { AddPinDialog } from "./add-pin-dialog";
import { BoardBar } from "./board-bar";
import { BoardDialog, ShareDialog } from "./board-dialogs";
import { Masonry } from "./masonry";
import { PaletteStrip } from "./palette-strip";
import { PinCard } from "./pin-card";
import { PinImage } from "./pin-image";
import { PinLightbox } from "./pin-lightbox";

type Option = { id: string; name: string };
type Props = InspirationData & {
  categories: Option[];
  vendors: Option[];
  weddingId: string;
  userId: string;
  canEdit: boolean;
  unsplashEnabled: boolean;
};

const STARTER_BOARDS = ["attire", "flowers", "decor", "cake", "beauty", "venue"] as const;
type Filter = "all" | "love" | "maybe" | "hearted";

export function InspirationPage(props: Props) {
  const { canEdit, userId } = props;
  const t = useTranslations("inspiration");
  // Local copies so moves and hearts show instantly; the server refresh replaces them.
  const [boards, setBoards] = useState(props.boards);
  const [pins, setPins] = useState(props.pins);
  useEffect(() => setBoards(props.boards), [props.boards]);
  useEffect(() => setPins(props.pins), [props.pins]);

  const [selected, setSelected] = useState("all");
  const [filter, setFilter] = useState<Filter>("all");
  const [tag, setTag] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [boardDialog, setBoardDialog] = useState<"new" | "edit" | null>(null);
  const [sharing, setSharing] = useState<BoardView | null>(null);
  const [dragging, setDragging] = useState<PinView | null>(null);
  const [starting, startTransition] = useTransition();

  const board = boards.find((b) => b.id === selected) ?? null;
  const boardKey = board ? board.id : "all";

  // Pins on the current board in their saved order (or everything, newest first).
  const boardPins = useMemo(
    () =>
      board
        ? pins.filter((p) => p.boardId === board.id).sort((a, b) => a.sortOrder - b.sortOrder)
        : [...pins].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [pins, board],
  );
  const tags = useMemo(() => [...new Set(boardPins.flatMap((p) => p.tags))].sort(), [boardPins]);
  const visible = useMemo(
    () =>
      boardPins.filter(
        (p) =>
          (filter === "all" ||
            (filter === "hearted" ? p.hearts.includes(userId) : p.status === filter)) &&
          (!tag || p.tags.includes(tag)),
      ),
    [boardPins, filter, tag, userId],
  );
  const openIndex = openId ? visible.findIndex((p) => p.id === openId) : -1;
  const openPin = openId ? (pins.find((p) => p.id === openId) ?? null) : null;

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function selectBoard(id: string) {
    setSelected(id);
    setTag(null);
  }

  function move(pin: PinView, boardId: string, sortOrder: number) {
    setPins((all) => all.map((p) => (p.id === pin.id ? { ...p, boardId, sortOrder } : p)));
    void movePin(pin.id, boardId, sortOrder).then((r) => {
      if (!r.ok) {
        toast.error(r.error);
        setPins(props.pins);
      }
    });
  }

  function moveToBoard(pin: PinView, boardId: string) {
    if (pin.boardId === boardId) return;
    const top = Math.min(1, ...pins.filter((p) => p.boardId === boardId).map((p) => p.sortOrder));
    move(pin, boardId, top - 1);
    toast.success(t("movedTo", { name: boards.find((b) => b.id === boardId)?.name ?? "" }));
  }

  function heart(pin: PinView) {
    const on = !pin.hearts.includes(userId);
    setPins((all) =>
      all.map((p) =>
        p.id === pin.id
          ? { ...p, hearts: on ? [...p.hearts, userId] : p.hearts.filter((h) => h !== userId) }
          : p,
      ),
    );
    void toggleHeart(pin.id).then((r) => !r.ok && (toast.error(r.error), setPins(props.pins)));
  }

  function onDragStart(e: DragStartEvent) {
    const id = String(e.active.id);
    if (id.startsWith("pin:")) setDragging(pins.find((p) => `pin:${p.id}` === id) ?? null);
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setDragging(null);
    const a = String(active.id);
    const o = over ? String(over.id) : null;
    if (!o || a === o) return;

    if (a.startsWith("board:") && o.startsWith("board:")) {
      const from = boards.findIndex((b) => `board:${b.id}` === a);
      const to = boards.findIndex((b) => `board:${b.id}` === o);
      const next = arrayMove(boards, from, to);
      setBoards(next);
      void reorderBoards(next.map((b) => b.id)).then(
        (r) => !r.ok && (toast.error(r.error), setBoards(props.boards)),
      );
      return;
    }

    const pin = pins.find((p) => `pin:${p.id}` === a);
    if (!pin) return;
    if (o.startsWith("board:")) return moveToBoard(pin, o.slice(6));
    // Dropped on another pin: take its place (only inside a board, where order is saved).
    if (o.startsWith("pin:") && board) {
      const list = boardPins.filter((p) => p.id !== pin.id);
      const at = list.findIndex((p) => `pin:${p.id}` === o);
      if (at < 0) return;
      const movingDown = boardPins.indexOf(pin) < boardPins.findIndex((p) => `pin:${p.id}` === o);
      const [before, after] = movingDown ? [list[at], list[at + 1]] : [list[at - 1], list[at]];
      move(pin, board.id, orderBetween(before?.sortOrder ?? null, after?.sortOrder ?? null));
    }
  }

  const empty = boards.length === 0;

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          canEdit &&
          !empty && (
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus aria-hidden /> {t("addPins")}
            </Button>
          )
        }
      />

      {props.palette.length > 0 && (
        <section aria-labelledby="palette-heading" className="mb-6">
          <h2 id="palette-heading" className="text-muted-foreground mb-2 text-sm font-medium">
            {t("palette")} <span className="font-normal">{t("paletteHint")}</span>
          </h2>
          <PaletteStrip colors={props.palette} canEdit={canEdit} />
        </section>
      )}

      {empty ? (
        <div className="rounded-2xl border border-dashed p-8 text-center sm:p-12">
          <Lightbulb className="text-primary-ink mx-auto size-10" aria-hidden />
          <h2 className="mt-4 text-2xl">{t("startTitle")}</h2>
          <p className="text-muted-foreground mx-auto mt-2 max-w-md">
            {canEdit ? t("startEditor") : t("startViewer")}
          </p>
          {canEdit && (
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {STARTER_BOARDS.map((key) => (
                <Button
                  key={key}
                  variant="outline"
                  disabled={starting}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await createBoard({ name: t(`starters.${key}`), description: "" });
                      if (!r.ok) toast.error(r.error);
                      else setSelected(r.data!.id);
                    })
                  }
                >
                  {t(`starters.${key}`)}
                </Button>
              ))}
              <Button onClick={() => setBoardDialog("new")} disabled={starting}>
                {starting ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}{" "}
                {t("yourOwn")}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <DndContext
          id="inspiration-dnd"
          sensors={sensors}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setDragging(null)}
        >
          <BoardBar
            boards={boards}
            selected={boardKey}
            total={pins.length}
            canEdit={canEdit}
            onSelect={selectBoard}
            onNew={() => setBoardDialog("new")}
          />

          <div className="mt-4 mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              {board ? (
                <>
                  <h2 className="text-2xl">{board.name}</h2>
                  {board.description && (
                    <p className="text-muted-foreground text-sm">{board.description}</p>
                  )}
                </>
              ) : (
                <h2 className="text-2xl">{t("allPins")}</h2>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
                <SelectTrigger size="sm" className="w-36" aria-label={t("show")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allPins")}</SelectItem>
                  <SelectItem value="love">{t("loveIt")}</SelectItem>
                  <SelectItem value="maybe">{t("maybe")}</SelectItem>
                  <SelectItem value="hearted">
                    <Heart aria-hidden /> {t("myHearts")}
                  </SelectItem>
                </SelectContent>
              </Select>
              {board && (canEdit || board.shareId) && (
                <Button variant="outline" size="sm" onClick={() => setSharing(board)}>
                  <Share2 aria-hidden /> {board.shareId ? t("shared") : t("share")}
                </Button>
              )}
              {board && canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBoardDialog("edit")}
                  aria-label={t("editName", { name: board.name })}
                >
                  <Pencil aria-hidden /> {t("edit")}
                </Button>
              )}
            </div>
          </div>

          {tags.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label={t("byTag")}>
              {tags.map((x) => (
                <button
                  key={x}
                  type="button"
                  aria-pressed={tag === x}
                  onClick={() => setTag(tag === x ? null : x)}
                  className={cn(
                    "focus-visible:ring-ring rounded-full border px-2.5 py-0.5 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none",
                    tag === x ? "bg-foreground text-background" : "hover:bg-accent",
                  )}
                >
                  #{x}
                </button>
              ))}
            </div>
          )}

          {visible.length === 0 ? (
            <div className="text-muted-foreground rounded-2xl border border-dashed p-10 text-center">
              {boardPins.length === 0 ? (
                <>
                  <p>{t("noPins")}</p>
                  {canEdit && (
                    <Button className="mt-4" onClick={() => setAdding(true)}>
                      <Plus aria-hidden /> {t("addFirst")}
                    </Button>
                  )}
                </>
              ) : (
                <p>{t("noMatch")}</p>
              )}
            </div>
          ) : (
            <>
              {canEdit && (
                <p className="text-muted-foreground mb-3 hidden text-xs sm:block">
                  {board ? t("tipBoard") : t("tipAll")}
                </p>
              )}
              <Masonry
                key={boardKey}
                items={visible}
                render={(pin) => (
                  <PinCard
                    key={pin.id}
                    pin={pin}
                    canDrag={canEdit}
                    hearted={pin.hearts.includes(userId)}
                    onOpen={() => setOpenId(pin.id)}
                  />
                )}
              />
            </>
          )}

          <DragOverlay dropAnimation={null}>
            {dragging && (
              <div className="w-40 rotate-2 overflow-hidden rounded-xl shadow-2xl">
                <PinImage
                  src={dragging.src}
                  alt={dragging.title || t("pin")}
                  width={dragging.width}
                  height={dragging.height}
                  size={300}
                />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      <PinLightbox
        pin={openPin}
        boards={boards}
        categories={props.categories}
        vendors={props.vendors}
        userId={userId}
        canEdit={canEdit}
        hasPrev={openIndex > 0}
        hasNext={openIndex >= 0 && openIndex < visible.length - 1}
        onPrev={() => openIndex > 0 && setOpenId(visible[openIndex - 1].id)}
        onNext={() => openIndex < visible.length - 1 && setOpenId(visible[openIndex + 1].id)}
        onClose={() => setOpenId(null)}
        onHeart={heart}
        onMove={moveToBoard}
      />

      {canEdit && !empty && (
        <AddPinDialog
          open={adding}
          onOpenChange={setAdding}
          boards={boards}
          defaultBoard={board?.id ?? boards[0].id}
          weddingId={props.weddingId}
          unsplashEnabled={props.unsplashEnabled}
        />
      )}
      <BoardDialog
        open={!!boardDialog}
        board={boardDialog === "edit" ? board : null}
        onOpenChange={(o) => !o && setBoardDialog(null)}
        onSaved={(id) => setSelected(id)}
        onDeleted={() => setSelected("all")}
      />
      <ShareDialog board={sharing} canEdit={canEdit} onOpenChange={(o) => !o && setSharing(null)} />
    </>
  );
}
