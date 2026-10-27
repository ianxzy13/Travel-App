"use client";

import { useRef, useState, useTransition } from "react";
import { ListMusic, Loader2, Pencil, Plus, Settings2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { deleteCategory, deleteSong, saveCategory, saveSong } from "@/app/app/playlist/actions";
import { PageHeader } from "@/components/app/page-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ActionResult } from "@/lib/action-result";
import type { PlaylistPriority } from "@/lib/database.types";
import { PRIORITIES, findDuplicate, groupSongs, type PriorityFilter } from "@/lib/playlist/songs";
import { cn } from "@/lib/utils";

export type PlaylistCategory = { id: string; name: string };
export type PlaylistSong = {
  id: string;
  category_id: string;
  title: string;
  artist: string;
  priority: PlaylistPriority;
};

const BADGE: Record<PlaylistPriority, string> = {
  must: "bg-success/15 text-success",
  nice: "bg-muted text-muted-foreground",
  no: "bg-destructive/10 text-destructive",
};

type Draft = { title: string; artist: string; categoryId: string; priority: PlaylistPriority };

type Confirm = { title: string; text?: string; action: () => Promise<ActionResult>; done: string };

export function PlaylistPage({
  categories,
  songs,
  canEdit,
}: {
  categories: PlaylistCategory[];
  songs: PlaylistSong[];
  canEdit: boolean;
}) {
  const t = useTranslations("playlist");
  const [filter, setFilter] = useState<PriorityFilter>("all");
  const [editing, setEditing] = useState<PlaylistSong | null>(null);
  const [manage, setManage] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [pending, startTransition] = useTransition();
  const titleRef = useRef<HTMLInputElement>(null);

  const groups = groupSongs(categories, songs, filter).filter(
    (g) => filter === "all" || g.songs.length > 0,
  );
  const count = (p: PriorityFilter) =>
    p === "all" ? songs.length : songs.filter((s) => s.priority === p).length;

  const runConfirm = () => {
    if (!confirm) return;
    const c = confirm;
    startTransition(async () => {
      const r = await c.action();
      if (r.ok) toast.success(c.done);
      else toast.error(r.error);
      setConfirm(null);
    });
  };

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          canEdit && (
            <Button variant="outline" size="sm" onClick={() => setManage(true)}>
              <Settings2 aria-hidden /> {t("categories.manage")}
            </Button>
          )
        }
      />

      {canEdit && (
        <section className="bg-card mb-6 rounded-xl border p-4">
          <h2 className="mb-3 text-lg">{t("add.title")}</h2>
          <SongForm
            key={categories[0]?.id ?? "none"}
            categories={categories}
            songs={songs}
            titleRef={titleRef}
            submitLabel={t("add.button")}
            onSaved={() => titleRef.current?.focus()}
          />
        </section>
      )}

      {songs.length === 0 ? (
        <div className="bg-card flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-12 text-center">
          <span className="bg-primary-soft text-primary-ink inline-flex size-12 items-center justify-center rounded-full">
            <ListMusic className="size-6" aria-hidden />
          </span>
          <p className="text-muted-foreground max-w-md">{t("empty.text")}</p>
          {canEdit && (
            <Button onClick={() => titleRef.current?.focus()}>
              <Plus aria-hidden /> {t("empty.button")}
            </Button>
          )}
        </div>
      ) : (
        <>
          <div role="group" aria-label={t("filter.label")} className="mb-4 flex flex-wrap gap-2">
            {(["all", ...PRIORITIES] as PriorityFilter[]).map((p) => (
              <Button
                key={p}
                size="sm"
                variant={filter === p ? "default" : "outline"}
                aria-pressed={filter === p}
                onClick={() => setFilter(p)}
              >
                {p === "all" ? t("filter.all") : t(`priority.${p}`)}
                <span className="tabular-nums opacity-70">{count(p)}</span>
              </Button>
            ))}
          </div>

          {groups.length === 0 && (
            <p className="text-muted-foreground bg-card rounded-xl border border-dashed p-6 text-center text-sm">
              {t("filter.none")}
            </p>
          )}

          <div className="space-y-6">
            {groups.map(({ category, songs: list }) => (
              <section key={category.id} aria-labelledby={`cat-${category.id}`}>
                <h2 id={`cat-${category.id}`} className="mb-2 flex items-baseline gap-2 text-xl">
                  {category.name}
                  <span className="text-muted-foreground text-sm tabular-nums">{list.length}</span>
                </h2>
                {list.length === 0 ? (
                  <p className="text-muted-foreground text-sm italic">{t("noSongs")}</p>
                ) : (
                  <ul className="bg-card divide-y rounded-xl border">
                    {list.map((s) => (
                      <li key={s.id} className="flex items-center gap-3 px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium break-words">{s.title}</p>
                          {s.artist && (
                            <p className="text-muted-foreground text-sm break-words">{s.artist}</p>
                          )}
                        </div>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                            BADGE[s.priority],
                          )}
                        >
                          {t(`priority.${s.priority}`)}
                        </span>
                        {canEdit && (
                          <div className="flex shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              aria-label={t("edit.label", { title: s.title })}
                              onClick={() => setEditing(s)}
                            >
                              <Pencil aria-hidden />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive size-8"
                              aria-label={t("delete.label", { title: s.title })}
                              onClick={() =>
                                setConfirm({
                                  title: t("delete.title", { title: s.title }),
                                  action: () => deleteSong(s.id),
                                  done: t("delete.done"),
                                })
                              }
                            >
                              <Trash2 aria-hidden />
                            </Button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </>
      )}

      {editing && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("edit.title")}</DialogTitle>
              <DialogDescription className="sr-only">{t("edit.title")}</DialogDescription>
            </DialogHeader>
            <SongForm
              song={editing}
              categories={categories}
              songs={songs}
              submitLabel={t("save")}
              stacked
              onSaved={() => setEditing(null)}
              onCancel={() => setEditing(null)}
            />
          </DialogContent>
        </Dialog>
      )}

      <CategoriesDialog
        open={manage}
        onOpenChange={setManage}
        categories={categories}
        songs={songs}
        onConfirm={setConfirm}
      />

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            {confirm?.text && <AlertDialogDescription>{confirm.text}</AlertDialogDescription>}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                runConfirm();
              }}
            >
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              {t("delete.button")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Song name, artist, category and priority: for adding and for editing. */
function SongForm({
  song,
  categories,
  songs,
  titleRef,
  submitLabel,
  stacked,
  onSaved,
  onCancel,
}: {
  song?: PlaylistSong;
  categories: PlaylistCategory[];
  songs: PlaylistSong[];
  titleRef?: React.Ref<HTMLInputElement>;
  submitLabel: string;
  stacked?: boolean;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const t = useTranslations("playlist");
  const empty: Draft = {
    title: "",
    artist: "",
    categoryId: categories[0]?.id ?? "",
    priority: "nice",
  };
  const [draft, setDraft] = useState<Draft>(
    song
      ? {
          title: song.title,
          artist: song.artist,
          categoryId: song.category_id,
          priority: song.priority,
        }
      : empty,
  );
  const [warned, setWarned] = useState(false);
  const [pending, startTransition] = useTransition();
  const dup = findDuplicate(songs, draft, song?.id);
  const dupCategory = dup ? categories.find((c) => c.id === dup.category_id)?.name : null;
  const set = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    if ("title" in patch || "artist" in patch) setWarned(false);
  };

  const submit = () => {
    if (dup && !warned) {
      setWarned(true);
      return;
    }
    startTransition(async () => {
      const r = await saveSong(song?.id ?? null, draft);
      if (!r.ok) return void toast.error(r.error);
      toast.success(song ? t("edit.done") : t("add.done", { title: draft.title.trim() }));
      if (!song) setDraft((d) => ({ ...empty, categoryId: d.categoryId, priority: d.priority }));
      setWarned(false);
      onSaved?.();
    });
  };

  const id = song ? `edit-${song.id}` : "add";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-3"
    >
      <div
        className={cn(
          "grid gap-3",
          !stacked && "sm:grid-cols-2 lg:grid-cols-[2fr_2fr_1.3fr_1.3fr_auto] lg:items-end",
        )}
      >
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-title`}>{t("field.title")}</Label>
          <Input
            id={`${id}-title`}
            ref={titleRef}
            value={draft.title}
            maxLength={200}
            required
            onChange={(e) => set({ title: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-artist`}>{t("field.artist")}</Label>
          <Input
            id={`${id}-artist`}
            value={draft.artist}
            maxLength={200}
            onChange={(e) => set({ artist: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-category`}>{t("field.category")}</Label>
          <Select value={draft.categoryId} onValueChange={(v) => set({ categoryId: v })}>
            <SelectTrigger id={`${id}-category`} className="w-full">
              <SelectValue placeholder={t("field.chooseCategory")} />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-priority`}>{t("field.priority")}</Label>
          <Select
            value={draft.priority}
            onValueChange={(v) => set({ priority: v as PlaylistPriority })}
          >
            <SelectTrigger id={`${id}-priority`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {t(`priority.${p}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {!stacked && (
          <Button
            type="submit"
            disabled={pending || !draft.title.trim() || !draft.categoryId}
            className="sm:col-span-2 lg:col-span-1"
          >
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
            {dup && warned ? t("duplicate.anyway") : submitLabel}
          </Button>
        )}
      </div>

      {dup && (
        <p
          role="status"
          className={cn(
            "rounded-md p-2 text-sm",
            warned ? "bg-warning/15" : "bg-muted/60 text-muted-foreground",
          )}
        >
          {t("duplicate.text", { category: dupCategory ?? "" })}
          {warned && ` ${t("duplicate.again")}`}
        </p>
      )}

      {stacked && (
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t("cancel")}
          </Button>
          <Button type="submit" disabled={pending || !draft.title.trim() || !draft.categoryId}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {dup && warned ? t("duplicate.anyway") : submitLabel}
          </Button>
        </DialogFooter>
      )}
    </form>
  );
}

function CategoriesDialog({
  open,
  onOpenChange,
  categories,
  songs,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: PlaylistCategory[];
  songs: PlaylistSong[];
  onConfirm: (c: Confirm) => void;
}) {
  const t = useTranslations("playlist");
  const [names, setNames] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState("");
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<ActionResult>, msg: string, after?: () => void) =>
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error);
      toast.success(msg);
      after?.();
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("categories.title")}</DialogTitle>
          <DialogDescription>{t("categories.text")}</DialogDescription>
        </DialogHeader>
        <ul className="space-y-2">
          {categories.map((c) => {
            const value = names[c.id] ?? c.name;
            const changed = value.trim() && value.trim() !== c.name;
            const n = songs.filter((s) => s.category_id === c.id).length;
            return (
              <li key={c.id}>
                <form
                  className="flex items-center gap-1.5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (changed)
                      run(() => saveCategory(c.id, { name: value }), t("categories.renamed"));
                  }}
                >
                  <Input
                    value={value}
                    maxLength={60}
                    aria-label={t("categories.rename", { name: c.name })}
                    onChange={(e) => setNames((m) => ({ ...m, [c.id]: e.target.value }))}
                  />
                  {changed && (
                    <Button type="submit" size="sm" disabled={pending}>
                      {t("save")}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive size-9 shrink-0"
                    aria-label={t("categories.delete", { name: c.name })}
                    onClick={() =>
                      n === 0
                        ? run(() => deleteCategory(c.id), t("categories.deleted"))
                        : onConfirm({
                            title: t("categories.deleteTitle", { name: c.name }),
                            text: t("categories.deleteText", { count: n }),
                            action: () => deleteCategory(c.id),
                            done: t("categories.deleted"),
                          })
                    }
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </form>
              </li>
            );
          })}
        </ul>
        <form
          className="flex items-end gap-1.5 border-t pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (newName.trim())
              run(
                () => saveCategory(null, { name: newName }),
                t("categories.added"),
                () => setNewName(""),
              );
          }}
        >
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="new-category">{t("categories.new")}</Label>
            <Input
              id="new-category"
              value={newName}
              maxLength={60}
              placeholder={t("categories.newPlaceholder")}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={pending || !newName.trim()}>
            <Plus aria-hidden /> {t("categories.add")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
