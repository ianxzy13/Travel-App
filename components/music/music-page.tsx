"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  DndContext,
  MouseSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  Inbox,
  Link2,
  ListMusic,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Printer,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  acceptSuggestion,
  deleteMoment,
  deleteSong,
  reorderMoments,
  reorderSongs,
  saveMoment,
  saveSong,
  setMomentHidden,
  setSuggestionStatus,
} from "@/app/app/music/actions";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";
import type { MusicPriority } from "@/lib/database.types";
import {
  DO_NOT_PLAY,
  buildDjText,
  findDuplicate,
  linkKind,
  moveItem,
  mustAndBanned,
  parseSongInput,
  songLabel,
} from "@/lib/music/songs";
import {
  toDjMoments,
  type MusicMoment,
  type MusicSong,
  type MusicSuggestion,
} from "@/lib/music/types";
import { cn } from "@/lib/utils";

type ScheduleOption = { id: string; time: string; day: string | null; title: string };
type VendorOption = { id: string; name: string; music: boolean };

type Props = {
  moments: MusicMoment[];
  songs: MusicSong[];
  suggestions: MusicSuggestion[];
  schedule: ScheduleOption[];
  vendors: VendorOption[];
  couple: string;
  dateLabel: string | null;
  canEdit: boolean;
};

export const PRIORITY_CLASS: Record<MusicPriority, string> = {
  must: "bg-success/15 text-success",
  nice: "bg-muted text-muted-foreground",
  no: "bg-destructive/10 text-destructive",
};

const LANGUAGES = ["SL", "EN", "HR", "DE", "IT", "ES"];
const PREFS_KEY = "vow_music_prefs";

/** Props copied into state for quick (optimistic) moves; reset whenever the server sends new ones. */
function useSynced<T>(value: T) {
  const [state, setState] = useState(value);
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    setPrev(value);
    setState(value);
  }
  return [state, setState] as const;
}

export function MusicPage(props: Props) {
  const t = useTranslations("music");
  const { canEdit } = props;
  const [moments, setMoments] = useSynced(props.moments);
  const [songs, setSongs] = useSynced(props.songs);
  const [pending, startTransition] = useTransition();
  const [showHidden, setShowHidden] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [songDialog, setSongDialog] = useState<{
    song: MusicSong | null;
    momentId: string;
    draft?: Partial<MusicSong>;
  } | null>(null);
  const [momentDialog, setMomentDialog] = useState<MusicMoment | "new" | null>(null);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [includeNice, setIncludeNice] = useState(true);
  const [vendorId, setVendorId] = useState("");

  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}");
      if (typeof p.includeNice === "boolean") setIncludeNice(p.includeNice);
      if (typeof p.vendorId === "string") setVendorId(p.vendorId);
    } catch {
      /* no saved choice */
    }
  }, []);
  const savePrefs = (next: { includeNice?: boolean; vendorId?: string }) => {
    const p = { includeNice, vendorId, ...next };
    setIncludeNice(p.includeNice);
    setVendorId(p.vendorId);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(p));
    } catch {
      /* private window */
    }
  };

  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 5 } }));
  const visible = moments.filter((m) => showHidden || !m.hidden);
  const hiddenCount = moments.filter((m) => m.hidden).length;
  const momentById = new Map(moments.map((m) => [m.id, m]));
  const dnpIds = new Set(moments.filter((m) => m.kind === DO_NOT_PLAY).map((m) => m.id));
  const conflicts = mustAndBanned(
    songs.map((s) => ({ ...s, moment_id: s.momentId })),
    dnpIds,
  );
  const songsIn = (momentId: string) => songs.filter((s) => s.momentId === momentId);
  const vendor = props.vendors.find((v) => v.id === vendorId) ?? null;
  const partyId =
    moments.find((m) => m.kind === "party" && !m.hidden)?.id ??
    moments.find((m) => m.kind !== DO_NOT_PLAY && !m.hidden)?.id ??
    moments[0]?.id ??
    "";

  function run(fn: () => Promise<ActionResult>, success?: string, onFail?: () => void) {
    startTransition(async () => {
      const r = await fn();
      if (r.ok) {
        if (success) toast.success(success);
      } else {
        toast.error(r.error);
        onFail?.();
      }
    });
  }

  /** Move a song to `momentId` at `index` (end when undefined), here and on the server. */
  function moveSong(songId: string, momentId: string, index?: number) {
    const song = songs.find((s) => s.id === songId);
    if (!song) return;
    const from = song.momentId;
    const target = songsIn(momentId).filter((s) => s.id !== songId);
    const at = index === undefined ? target.length : Math.max(0, Math.min(index, target.length));
    const dnp = momentById.get(momentId)?.kind === DO_NOT_PLAY;
    const moved: MusicSong = {
      ...song,
      momentId,
      priority: dnp ? "no" : song.priority === "no" ? "nice" : song.priority,
    };
    target.splice(at, 0, moved);
    const others = songs.filter((s) => s.momentId !== momentId && s.id !== songId);
    const before = songs;
    setSongs([...others, ...target]);
    const changed = [{ momentId, songIds: target.map((s) => s.id) }];
    if (from !== momentId)
      changed.push({
        momentId: from,
        songIds: songs.filter((s) => s.momentId === from && s.id !== songId).map((s) => s.id),
      });
    run(
      () => reorderSongs(changed),
      undefined,
      () => setSongs(before),
    );
  }

  function onDragEnd(e: DragEndEvent) {
    const songId = String(e.active.id).replace(/^song:/, "");
    const over = e.over ? String(e.over.id) : null;
    if (!over) return;
    if (over.startsWith("moment:")) return moveSong(songId, over.slice(7));
    if (over.startsWith("drop:")) {
      const target = songs.find((s) => s.id === over.slice(5));
      if (!target || target.id === songId) return;
      const list = songsIn(target.momentId).filter((s) => s.id !== songId);
      return moveSong(
        songId,
        target.momentId,
        list.findIndex((s) => s.id === target.id),
      );
    }
  }

  function moveMoment(momentId: string, dir: -1 | 1) {
    const i = moments.findIndex((m) => m.id === momentId);
    // skip over hidden moments when they aren't shown
    let j = i + dir;
    while (j >= 0 && j < moments.length && !showHidden && moments[j].hidden) j += dir;
    if (j < 0 || j >= moments.length) return;
    const next = moveItem(moments, i, j);
    const before = moments;
    setMoments(next);
    run(
      () => reorderMoments(next.map((m) => m.id)),
      undefined,
      () => setMoments(before),
    );
  }

  const djText = () =>
    buildDjText({
      heading: [
        props.couple,
        props.dateLabel ?? "",
        vendor ? t("dj.for", { name: vendor.name }) : "",
      ],
      moments: toDjMoments({ moments, songs }),
      includeNice,
      labels: {
        priority: { must: t("priority.must"), nice: t("priority.nice"), no: t("priority.no") },
        noSongs: t("dj.noSongs"),
      },
    });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(djText());
      toast.success(t("dj.copied"));
    } catch {
      toast.error(t("dj.copyFailed"));
    }
  };

  const printHref = `/print/music?nice=${includeNice ? 1 : 0}${vendorId ? `&vendor=${vendorId}` : ""}`;

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant={props.suggestions.length ? "default" : "outline"}
              size="sm"
              onClick={() => setInboxOpen(true)}
            >
              <Inbox aria-hidden /> {t("inbox.button")}
              {props.suggestions.length > 0 && (
                <span className="bg-primary-foreground text-primary rounded-full px-1.5 text-xs font-medium tabular-nums">
                  {props.suggestions.length}
                </span>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={copy}>
              <Copy aria-hidden /> {t("dj.copy")}
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={printHref}>
                <Printer aria-hidden /> {t("dj.print")}
              </Link>
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" aria-label={t("dj.settings")}>
                  <Settings2 aria-hidden />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 space-y-4">
                <p className="text-sm font-medium">{t("dj.settings")}</p>
                <label className="flex items-center justify-between gap-3 text-sm">
                  {t("dj.includeNice")}
                  <Switch
                    checked={includeNice}
                    onCheckedChange={(v) => savePrefs({ includeNice: v })}
                  />
                </label>
                <div className="space-y-1.5">
                  <Label htmlFor="dj-vendor">{t("dj.vendor")}</Label>
                  <Select
                    value={vendorId || "none"}
                    onValueChange={(v) => savePrefs({ vendorId: v === "none" ? "" : v })}
                  >
                    <SelectTrigger id="dj-vendor">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("dj.noVendor")}</SelectItem>
                      {props.vendors.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {props.vendors.length === 0 && (
                    <p className="text-muted-foreground text-xs">{t("dj.noVendors")}</p>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        }
      />

      {conflicts.length > 0 && (
        <div role="status" className="bg-warning/10 mb-4 flex gap-2 rounded-xl p-3 text-sm">
          <AlertTriangle className="text-warning mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            {t("conflict", {
              songs: [...new Set(conflicts.map((s) => songLabel(s)))].join(", "),
            })}
          </p>
        </div>
      )}

      {songs.length === 0 && (
        <div className="bg-card mb-6 flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-10 text-center">
          <span className="bg-primary-soft text-primary-ink inline-flex size-12 items-center justify-center rounded-full">
            <ListMusic className="size-6" aria-hidden />
          </span>
          <p className="text-muted-foreground max-w-md">{t("empty.text")}</p>
          {canEdit && partyId && (
            <Button
              onClick={() =>
                setSongDialog({
                  song: null,
                  momentId: moments.find((m) => m.kind === "first_dance")?.id ?? partyId,
                })
              }
            >
              <Plus aria-hidden /> {t("empty.button")}
            </Button>
          )}
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={onDragEnd}>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:overflow-x-auto md:pb-4">
          {visible.map((m, i) => (
            <MomentColumn
              key={m.id}
              moment={m}
              songs={songsIn(m.id)}
              allSongs={songs}
              moments={moments}
              canEdit={canEdit}
              pending={pending}
              collapsed={collapsed.has(m.id)}
              first={i === 0}
              last={i === visible.length - 1}
              onToggle={() =>
                setCollapsed((c) => {
                  const n = new Set(c);
                  if (n.has(m.id)) n.delete(m.id);
                  else n.add(m.id);
                  return n;
                })
              }
              onEditMoment={() => setMomentDialog(m)}
              onMoveMoment={(dir) => moveMoment(m.id, dir)}
              onHide={() =>
                run(
                  () => setMomentHidden(m.id, !m.hidden),
                  m.hidden ? undefined : t("moment.hiddenDone"),
                )
              }
              onDeleteMoment={() => {
                if (
                  window.confirm(
                    t("moment.deleteConfirm", { name: m.name, count: songsIn(m.id).length }),
                  )
                )
                  run(() => deleteMoment(m.id), t("moment.deleted"));
              }}
              onOpenSong={(song, draft) => setSongDialog({ song, momentId: m.id, draft })}
              onAdd={(draft) =>
                run(() =>
                  saveSong(null, {
                    momentId: m.id,
                    title: draft.title,
                    artist: draft.artist,
                    url: draft.url ?? "",
                    note: "",
                    priority: m.kind === DO_NOT_PLAY ? "no" : "nice",
                    language: "",
                  }),
                )
              }
              onMove={moveSong}
              onDelete={(s) => {
                const before = songs;
                setSongs(songs.filter((x) => x.id !== s.id));
                run(
                  () => deleteSong(s.id),
                  t("song.deleted"),
                  () => setSongs(before),
                );
              }}
            />
          ))}
          {canEdit && (
            <Button
              variant="outline"
              className="shrink-0 border-dashed md:w-56"
              onClick={() => setMomentDialog("new")}
            >
              <Plus aria-hidden /> {t("moment.add")}
            </Button>
          )}
        </div>
      </DndContext>

      {hiddenCount > 0 && (
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => setShowHidden((v) => !v)}>
          {showHidden ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          {showHidden ? t("moment.hideHidden") : t("moment.showHidden", { count: hiddenCount })}
        </Button>
      )}

      {songDialog && (
        <SongDialog
          song={songDialog.song}
          draft={songDialog.draft}
          momentId={songDialog.momentId}
          moments={moments}
          songs={songs}
          onClose={() => setSongDialog(null)}
        />
      )}
      {momentDialog && (
        <MomentDialog
          moment={momentDialog === "new" ? null : momentDialog}
          schedule={props.schedule}
          onClose={() => setMomentDialog(null)}
        />
      )}
      <SuggestionInbox
        open={inboxOpen}
        onOpenChange={setInboxOpen}
        suggestions={props.suggestions}
        moments={moments}
        songs={songs}
        defaultMoment={partyId}
        canEdit={canEdit}
      />
    </>
  );
}

function MomentColumn({
  moment: m,
  songs,
  allSongs,
  moments,
  canEdit,
  pending,
  collapsed,
  first,
  last,
  onToggle,
  onEditMoment,
  onMoveMoment,
  onHide,
  onDeleteMoment,
  onOpenSong,
  onAdd,
  onMove,
  onDelete,
}: {
  moment: MusicMoment;
  songs: MusicSong[];
  allSongs: MusicSong[];
  moments: MusicMoment[];
  canEdit: boolean;
  pending: boolean;
  collapsed: boolean;
  first: boolean;
  last: boolean;
  onToggle: () => void;
  onEditMoment: () => void;
  onMoveMoment: (dir: -1 | 1) => void;
  onHide: () => void;
  onDeleteMoment: () => void;
  onOpenSong: (song: MusicSong | null, draft?: Partial<MusicSong>) => void;
  onAdd: (draft: { title: string; artist: string; url: string | null }) => void;
  onMove: (songId: string, momentId: string, index?: number) => void;
  onDelete: (song: MusicSong) => void;
}) {
  const t = useTranslations("music");
  const { setNodeRef, isOver } = useDroppable({ id: `moment:${m.id}`, disabled: !canEdit });
  const dnp = m.kind === DO_NOT_PLAY;
  const musts = songs.filter((s) => s.priority === "must").length;

  return (
    <section
      ref={setNodeRef}
      aria-label={m.name}
      className={cn(
        "bg-card flex shrink-0 flex-col rounded-xl border md:w-72",
        dnp && "border-destructive/30",
        m.hidden && "opacity-60",
        isOver && "ring-primary ring-2",
      )}
    >
      <header className="flex items-center gap-1 border-b p-2 ps-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          className="flex min-w-0 flex-1 items-center gap-2 text-start md:pointer-events-none"
        >
          <ChevronDown
            className={cn(
              "size-4 shrink-0 transition-transform md:hidden",
              collapsed && "-rotate-90",
            )}
            aria-hidden
          />
          <span className="min-w-0 flex-1">
            <span className={cn("block truncate font-medium", dnp && "text-destructive")}>
              {m.name}
            </span>
            <span className="text-muted-foreground block truncate text-xs">
              {[
                m.time,
                t("moment.count", { count: songs.length }),
                musts && !dnp ? t("moment.musts", { count: musts }) : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </span>
        </button>
        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={t("moment.menu", { name: m.name })}
              >
                <MoreVertical aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onEditMoment}>
                <Pencil aria-hidden /> {t("moment.edit")}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={first || pending} onSelect={() => onMoveMoment(-1)}>
                <ArrowLeft className="rtl:rotate-180" aria-hidden /> {t("moment.moveEarlier")}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={last || pending} onSelect={() => onMoveMoment(1)}>
                <ArrowRight className="rtl:rotate-180" aria-hidden /> {t("moment.moveLater")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onHide}>
                {m.hidden ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
                {m.hidden ? t("moment.show") : t("moment.hide")}
              </DropdownMenuItem>
              {!dnp && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={onDeleteMoment}>
                    <Trash2 aria-hidden /> {t("moment.delete")}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      <div className={cn("flex flex-col gap-1.5 p-2", collapsed && "hidden md:flex")}>
        {songs.length === 0 && (
          <p className="text-muted-foreground px-1 py-2 text-center text-xs italic">
            {dnp ? t("moment.emptyDnp") : t("moment.empty")}
          </p>
        )}
        <ol className="flex flex-col gap-1.5">
          {songs.map((s, i) => (
            <SongCard
              key={s.id}
              song={s}
              index={i}
              count={songs.length}
              moment={m}
              moments={moments}
              canEdit={canEdit}
              onOpen={() => onOpenSong(s)}
              onMove={onMove}
              onDelete={() => onDelete(s)}
            />
          ))}
        </ol>
        {canEdit && (
          <QuickAdd
            moment={m}
            songs={allSongs}
            moments={moments}
            onAdd={onAdd}
            onDetails={(draft) => onOpenSong(null, draft)}
          />
        )}
      </div>
    </section>
  );
}

function SongCard({
  song: s,
  index,
  count,
  moment,
  moments,
  canEdit,
  onOpen,
  onMove,
  onDelete,
}: {
  song: MusicSong;
  index: number;
  count: number;
  moment: MusicMoment;
  moments: MusicMoment[];
  canEdit: boolean;
  onOpen: () => void;
  onMove: (songId: string, momentId: string, index?: number) => void;
  onDelete: () => void;
}) {
  const t = useTranslations("music");
  const drag = useDraggable({ id: `song:${s.id}`, disabled: !canEdit });
  const drop = useDroppable({ id: `drop:${s.id}`, disabled: !canEdit });
  const dnp = moment.kind === DO_NOT_PLAY;
  const kind = linkKind(s.url);

  return (
    <li
      ref={(el) => {
        drag.setNodeRef(el);
        drop.setNodeRef(el);
      }}
      className={cn(
        "bg-background group flex items-start gap-1 rounded-lg border p-2 text-sm",
        drag.isDragging && "opacity-40",
        drop.isOver && !drag.isDragging && "border-t-primary border-t-2",
      )}
    >
      {canEdit && (
        <span
          {...drag.listeners}
          {...drag.attributes}
          className="text-muted-foreground mt-0.5 hidden cursor-grab touch-none md:block"
          aria-label={t("song.drag", { title: s.title })}
        >
          <GripVertical className="size-4" aria-hidden />
        </span>
      )}
      <button
        type="button"
        onClick={canEdit ? onOpen : undefined}
        disabled={!canEdit}
        className="min-w-0 flex-1 text-start disabled:cursor-default"
      >
        <span className="block font-medium break-words">{s.title}</span>
        {s.artist && (
          <span className="text-muted-foreground block text-xs break-words">{s.artist}</span>
        )}
        <span className="mt-1 flex flex-wrap items-center gap-1">
          {!dnp && (
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                PRIORITY_CLASS[s.priority],
              )}
            >
              {t(`priority.${s.priority}`)}
            </span>
          )}
          {s.language && (
            <span className="bg-primary-soft text-primary-ink rounded-full px-1.5 py-0.5 text-[10px] font-medium">
              {s.language}
            </span>
          )}
          {kind && (
            <span className="text-muted-foreground inline-flex items-center gap-0.5 text-[10px]">
              <Link2 className="size-3" aria-hidden /> {t(`link.${kind}`)}
            </span>
          )}
        </span>
        {s.note && (
          <span className="text-muted-foreground mt-1 block text-xs italic">{s.note}</span>
        )}
        {s.suggestedBy && (
          <span className="text-muted-foreground mt-1 block text-[11px]">
            {t("song.suggestedBy", { name: s.suggestedBy })}
          </span>
        )}
      </button>
      {canEdit && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              aria-label={t("song.menu", { title: s.title })}
            >
              <MoreVertical className="size-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onOpen}>
              <Pencil aria-hidden /> {t("song.edit")}
            </DropdownMenuItem>
            {s.url && (
              <DropdownMenuItem asChild>
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  <Link2 aria-hidden /> {t("song.open")}
                </a>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              disabled={index === 0}
              onSelect={() => onMove(s.id, moment.id, index - 1)}
            >
              <ArrowUp aria-hidden /> {t("song.up")}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={index === count - 1}
              onSelect={() => onMove(s.id, moment.id, index + 1)}
            >
              <ArrowDown aria-hidden /> {t("song.down")}
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>{t("song.moveTo")}</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-80 overflow-y-auto">
                {moments
                  .filter((m) => m.id !== moment.id)
                  .map((m) => (
                    <DropdownMenuItem key={m.id} onSelect={() => onMove(s.id, m.id)}>
                      {m.name}
                    </DropdownMenuItem>
                  ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash2 aria-hidden /> {t("song.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  );
}

/** One box: "Etta James – At Last", or a pasted link. */
function QuickAdd({
  moment,
  songs,
  moments,
  onAdd,
  onDetails,
}: {
  moment: MusicMoment;
  songs: MusicSong[];
  moments: MusicMoment[];
  onAdd: (draft: { title: string; artist: string; url: string | null }) => void;
  onDetails: (draft: Partial<MusicSong>) => void;
}) {
  const t = useTranslations("music");
  const [text, setText] = useState("");
  const [dup, setDup] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  const submit = (force = false) => {
    const p = parseSongInput(text);
    if (!p.title && !p.url) return;
    if (!p.title) {
      // A link alone: open the form so they can type the title.
      onDetails({ title: "", artist: "", url: p.url });
      setText("");
      return;
    }
    const existing = findDuplicate(songs, p);
    if (existing && !force) {
      const where = moments.find((m) => m.id === existing.momentId)?.name ?? "";
      setDup(t("song.duplicate", { song: songLabel(existing), moment: where }));
      return;
    }
    onAdd(p);
    setText("");
    setDup(null);
    ref.current?.focus();
  };

  return (
    <form
      className="space-y-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex gap-1">
        <Input
          ref={ref}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setDup(null);
          }}
          placeholder={t("song.quickPlaceholder")}
          aria-label={t("song.quickLabel", { moment: moment.name })}
          className="h-8 text-sm"
          maxLength={700}
        />
        <Button
          type="submit"
          size="icon"
          variant="outline"
          className="size-8 shrink-0"
          aria-label={t("song.add")}
        >
          <Plus aria-hidden />
        </Button>
      </div>
      {dup && (
        <div className="bg-warning/10 space-y-1.5 rounded-md p-2 text-xs" role="status">
          <p>{dup}</p>
          <div className="flex gap-1">
            <Button type="button" size="sm" className="h-7" onClick={() => submit(true)}>
              {t("song.addAnyway")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7"
              onClick={() => setDup(null)}
            >
              {t("cancel")}
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}

function SongDialog({
  song,
  draft,
  momentId: initialMoment,
  moments,
  songs,
  onClose,
}: {
  song: MusicSong | null;
  draft?: Partial<MusicSong>;
  momentId: string;
  moments: MusicMoment[];
  songs: MusicSong[];
  onClose: () => void;
}) {
  const t = useTranslations("music");
  const start = { ...draft, ...song };
  const [momentId, setMomentId] = useState(start.momentId ?? initialMoment);
  const [title, setTitle] = useState(start.title ?? "");
  const [artist, setArtist] = useState(start.artist ?? "");
  const [url, setUrl] = useState(start.url ?? "");
  const [note, setNote] = useState(start.note ?? "");
  const [priority, setPriority] = useState<MusicPriority>(start.priority ?? "nice");
  const [language, setLanguage] = useState(start.language ?? "");
  const [confirmDup, setConfirmDup] = useState(false);
  const [pending, startTransition] = useTransition();
  const dnp = moments.find((m) => m.id === momentId)?.kind === DO_NOT_PLAY;
  const dup = title.trim() ? findDuplicate(songs, { title, artist }, song?.id) : null;
  const badUrl = !!url.trim() && !/^https:\/\/\S+$/.test(url.trim());

  // Pasting "Artist – Title" into the title box fills both.
  const onTitle = (value: string) => {
    const p = parseSongInput(value);
    if (p.artist && !artist) {
      setTitle(p.title);
      setArtist(p.artist);
    } else setTitle(value);
    if (p.url && !url) setUrl(p.url);
    setConfirmDup(false);
  };

  const save = () => {
    if (dup && !confirmDup) {
      setConfirmDup(true);
      return;
    }
    startTransition(async () => {
      const r = await saveSong(song?.id ?? null, {
        momentId,
        title,
        artist,
        url: url.trim() ? (parseSongInput(url).url ?? url.trim()) : "",
        note,
        priority: dnp ? "no" : priority,
        language,
      });
      if (r.ok) {
        toast.success(t("song.saved"));
        onClose();
      } else toast.error(r.error);
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{song ? t("song.editTitle") : t("song.newTitle")}</DialogTitle>
          <DialogDescription>{t("song.dialogText")}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="song-title">{t("song.title")}</Label>
            <Input
              id="song-title"
              value={title}
              maxLength={200}
              onChange={(e) => onTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="song-artist">{t("song.artist")}</Label>
            <Input
              id="song-artist"
              value={artist}
              maxLength={200}
              onChange={(e) => {
                setArtist(e.target.value);
                setConfirmDup(false);
              }}
            />
          </div>
          {dup && (
            <p className="bg-warning/10 rounded-md p-2 text-xs" role="status">
              {t("song.duplicate", {
                song: songLabel(dup),
                moment: moments.find((m) => m.id === dup.momentId)?.name ?? "",
              })}
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="song-url">{t("song.url")}</Label>
            <Input
              id="song-url"
              type="url"
              inputMode="url"
              value={url}
              maxLength={700}
              placeholder="https://open.spotify.com/…"
              aria-invalid={badUrl || undefined}
              onChange={(e) => setUrl(e.target.value)}
            />
            {badUrl && <p className="text-destructive text-xs">{t("song.urlHint")}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="song-note">{t("song.note")}</Label>
            <Textarea
              id="song-note"
              rows={2}
              maxLength={500}
              value={note}
              placeholder={t("song.notePlaceholder")}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="song-priority">{t("song.priority")}</Label>
              <Select
                value={dnp ? "no" : priority}
                disabled={dnp}
                onValueChange={(v) => setPriority(v as MusicPriority)}
              >
                <SelectTrigger id="song-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="must">{t("priority.must")}</SelectItem>
                  <SelectItem value="nice">{t("priority.nice")}</SelectItem>
                  {dnp && <SelectItem value="no">{t("priority.no")}</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="song-lang">{t("song.language")}</Label>
              <Input
                id="song-lang"
                list="song-languages"
                value={language}
                maxLength={10}
                placeholder={t("song.languagePlaceholder")}
                onChange={(e) => setLanguage(e.target.value.toUpperCase())}
              />
              <datalist id="song-languages">
                {LANGUAGES.map((l) => (
                  <option key={l} value={l} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="song-moment">{t("song.moment")}</Label>
            <Select value={momentId} onValueChange={setMomentId}>
              <SelectTrigger id="song-moment">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {moments.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={!title.trim() || badUrl || pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              {dup && confirmDup ? t("song.addAnyway") : t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MomentDialog({
  moment,
  schedule,
  onClose,
}: {
  moment: MusicMoment | null;
  schedule: ScheduleOption[];
  onClose: () => void;
}) {
  const t = useTranslations("music");
  const [name, setName] = useState(moment?.name ?? "");
  const [scheduleItemId, setScheduleItemId] = useState(moment?.scheduleItemId ?? "");
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const r = await saveMoment(moment?.id ?? null, {
        name,
        scheduleItemId,
        hidden: moment?.hidden ?? false,
      });
      if (r.ok) {
        toast.success(t("moment.saved"));
        onClose();
      } else toast.error(r.error);
    });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{moment ? t("moment.editTitle") : t("moment.newTitle")}</DialogTitle>
          <DialogDescription>{t("moment.dialogText")}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="moment-name">{t("moment.name")}</Label>
            <Input
              id="moment-name"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="moment-schedule">{t("moment.schedule")}</Label>
            <Select
              value={scheduleItemId || "none"}
              onValueChange={(v) => setScheduleItemId(v === "none" ? "" : v)}
            >
              <SelectTrigger id="moment-schedule">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("moment.noSchedule")}</SelectItem>
                {schedule.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {[s.day, s.time, s.title].filter(Boolean).join(" · ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {schedule.length === 0 && (
              <p className="text-muted-foreground text-xs">
                {t.rich("moment.noScheduleYet", {
                  link: (c) => (
                    <Link href="/app/schedule" className="underline underline-offset-2">
                      {c}
                    </Link>
                  ),
                })}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={!name.trim() || pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SuggestionInbox({
  open,
  onOpenChange,
  suggestions,
  moments,
  songs,
  defaultMoment,
  canEdit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestions: MusicSuggestion[];
  moments: MusicMoment[];
  songs: MusicSong[];
  defaultMoment: string;
  canEdit: boolean;
}) {
  const t = useTranslations("music");
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("inbox.title")}</SheetTitle>
          <SheetDescription>{t("inbox.text")}</SheetDescription>
        </SheetHeader>
        <div className="space-y-3 px-4 pb-6">
          {suggestions.length === 0 ? (
            <p className="text-muted-foreground bg-muted/40 rounded-xl p-6 text-center text-sm">
              {t("inbox.empty")}
            </p>
          ) : (
            suggestions.map((s) => (
              <SuggestionCard
                key={s.id}
                suggestion={s}
                moments={moments}
                songs={songs}
                defaultMoment={defaultMoment}
                canEdit={canEdit}
              />
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SuggestionCard({
  suggestion: s,
  moments,
  songs,
  defaultMoment,
  canEdit,
}: {
  suggestion: MusicSuggestion;
  moments: MusicMoment[];
  songs: MusicSong[];
  defaultMoment: string;
  canEdit: boolean;
}) {
  const t = useTranslations("music");
  const [momentId, setMomentId] = useState(defaultMoment);
  const [pending, startTransition] = useTransition();
  const dup = findDuplicate(songs, s);

  const act = (fn: () => Promise<ActionResult>, msg: string, undo?: () => Promise<ActionResult>) =>
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error);
      toast.success(
        msg,
        undo ? { action: { label: t("inbox.undo"), onClick: () => void undo() } } : undefined,
      );
    });

  return (
    <div className="bg-card space-y-2 rounded-xl border p-3">
      <div>
        <p className="font-medium break-words">{s.title}</p>
        {s.artist && <p className="text-muted-foreground text-sm break-words">{s.artist}</p>}
        <p className="text-muted-foreground mt-1 text-xs">
          {s.guestName ? t("inbox.from", { name: s.guestName }) : t("inbox.fromGuest")}
        </p>
        {dup && (
          <p className="text-warning mt-1 text-xs">
            {t("inbox.already", { moment: moments.find((m) => m.id === dup.momentId)?.name ?? "" })}
          </p>
        )}
      </div>
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <Select value={momentId} onValueChange={setMomentId}>
            <SelectTrigger className="h-8 min-w-0 flex-1" aria-label={t("inbox.moment")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {moments.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            className="h-8"
            disabled={pending || !momentId}
            onClick={() =>
              act(
                () => acceptSuggestion(s.id, momentId),
                t("inbox.added", { moment: moments.find((m) => m.id === momentId)?.name ?? "" }),
              )
            }
          >
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
            {t("inbox.add")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8"
            disabled={pending}
            onClick={() =>
              act(
                () => setSuggestionStatus(s.id, "dismissed"),
                t("inbox.dismissed"),
                () => setSuggestionStatus(s.id, "new"),
              )
            }
          >
            <X aria-hidden /> {t("inbox.dismiss")}
          </Button>
        </div>
      )}
    </div>
  );
}
