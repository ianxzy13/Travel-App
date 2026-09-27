"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, ImagePlus, Link2, Loader2, Search, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { discardUpload } from "@/app/app/file-actions";
import {
  addLinkPin,
  addUnsplashPin,
  addUploadedPin,
  discoverPhotos,
  previewLink,
} from "@/app/app/inspiration/actions";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { LinkPreview } from "@/lib/inspiration/link-preview";
import type { BoardView } from "@/lib/inspiration/load";
import type { UnsplashPhoto } from "@/lib/inspiration/unsplash";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { UNSPLASH_LINK } from "./pin-image";

const BUCKET = "wedding-files";
const MAX_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const IDEAS = [
  "Bouquets",
  "Table settings",
  "Cakes",
  "Dresses",
  "Ceremony arch",
  "Invitations",
  "Hairstyles",
  "Rustic barn",
  "Beach",
  "Candles",
];

export function AddPinDialog({
  open,
  onOpenChange,
  boards,
  defaultBoard,
  weddingId,
  unsplashEnabled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boards: BoardView[];
  defaultBoard: string;
  weddingId: string;
  unsplashEnabled: boolean;
}) {
  const [boardId, setBoardId] = useState(defaultBoard);
  useEffect(() => {
    if (open) setBoardId(defaultBoard);
  }, [open, defaultBoard]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add pins</DialogTitle>
          <DialogDescription>
            Upload your own photos, save an image from any website, or discover ideas.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="add-board">Save to board</Label>
          <Select value={boardId} onValueChange={setBoardId}>
            <SelectTrigger id="add-board" className="w-full sm:w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {boards.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Tabs defaultValue="upload">
          <TabsList className="w-full">
            <TabsTrigger value="upload">
              <Upload aria-hidden /> Upload
            </TabsTrigger>
            <TabsTrigger value="link">
              <Link2 aria-hidden /> Link
            </TabsTrigger>
            <TabsTrigger value="discover">
              <Sparkles aria-hidden /> Discover
            </TabsTrigger>
          </TabsList>
          <TabsContent value="upload" className="pt-3">
            <UploadTab boardId={boardId} weddingId={weddingId} />
          </TabsContent>
          <TabsContent value="link" className="pt-3">
            <LinkTab boardId={boardId} onDone={() => onOpenChange(false)} />
          </TabsContent>
          <TabsContent value="discover" className="pt-3">
            {unsplashEnabled ? <DiscoverTab boardId={boardId} /> : <DiscoverSetup />}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

async function sizeOf(file: File) {
  try {
    const bmp = await createImageBitmap(file);
    const size = { width: bmp.width, height: bmp.height };
    bmp.close();
    return size;
  } catch {
    return { width: null, height: null };
  }
}

function UploadTab({ boardId, weddingId }: { boardId: string; weddingId: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [over, setOver] = useState(false);

  async function upload(files: File[]) {
    const ok = files
      .filter((f) => IMAGE_TYPES.includes(f.type) && f.size <= MAX_BYTES)
      .slice(0, 20);
    if (ok.length < files.length)
      toast.warning(
        "Some files were skipped: only JPG, PNG, WebP or GIF up to 10 MB (20 at a time).",
      );
    if (!ok.length) return;
    setProgress({ done: 0, total: ok.length });
    const sb = createClient();
    let saved = 0;
    for (const file of ok) {
      const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
      const path = `${weddingId}/pins/${crypto.randomUUID()}-${safeName}`;
      const { width, height } = await sizeOf(file);
      const { error } = await sb.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) {
        console.error(error);
        toast.error(`Couldn't upload ${file.name}. Is file storage set up (see README)?`);
      } else {
        const r = await addUploadedPin({
          boardId,
          path,
          width,
          height,
          title: file.name.replace(/\.[^.]+$/, "").slice(0, 200),
        });
        if (r.ok) saved++;
        else {
          toast.error(r.error);
          void discardUpload(path);
        }
      }
      setProgress((p) => p && { ...p, done: p.done + 1 });
    }
    setProgress(null);
    if (saved) toast.success(saved === 1 ? "Pin added" : `${saved} pins added`);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        void upload([...e.dataTransfer.files]);
      }}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors",
        over && "border-primary bg-primary/5",
      )}
    >
      <input
        ref={input}
        type="file"
        multiple
        accept={IMAGE_TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          void upload(files);
        }}
      />
      <ImagePlus className="text-muted-foreground size-8" aria-hidden />
      <p className="text-sm">Drop photos here, or</p>
      <Button type="button" onClick={() => input.current?.click()} disabled={!!progress}>
        {progress ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
        {progress ? `Uploading ${progress.done + 1} of ${progress.total}…` : "Choose photos"}
      </Button>
      <p className="text-muted-foreground text-xs">
        JPG, PNG, WebP or GIF, up to 10 MB each. Only your wedding team can see them.
      </p>
    </div>
  );
}

function LinkTab({ boardId, onDone }: { boardId: string; onDone: () => void }) {
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [title, setTitle] = useState("");
  const [size, setSize] = useState<{ width: number | null; height: number | null }>({
    width: null,
    height: null,
  });
  const [error, setError] = useState<string>();
  const [looking, startLookup] = useTransition();
  const [saving, startSave] = useTransition();

  function lookUp(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    startLookup(async () => {
      const r = await previewLink(url.trim());
      if (!r.ok) {
        setError(r.error);
        setPreview(null);
        return;
      }
      setPreview(r.data);
      setTitle(r.data.title ?? "");
      setSize({ width: null, height: null });
    });
  }

  function save() {
    if (!preview) return;
    startSave(async () => {
      const r = await addLinkPin({
        boardId,
        imageUrl: preview.imageUrl,
        sourceUrl: preview.sourceUrl ?? "",
        title,
        ...size,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Pin added");
      setUrl("");
      setPreview(null);
      onDone();
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={lookUp} className="flex items-start gap-2">
        <FormField
          id="pin-url"
          label="Web address"
          error={error}
          className="flex-1"
          hint="A web page (we'll find its main picture) or a direct image link."
        >
          {(a) => (
            <Input
              {...a}
              type="url"
              required
              placeholder="https://…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          )}
        </FormField>
        <Button
          type="submit"
          variant="secondary"
          disabled={looking || !url.trim()}
          className="mt-[1.375rem]"
        >
          {looking ? <Loader2 className="animate-spin" aria-hidden /> : <Search aria-hidden />} Look
          up
        </Button>
      </form>
      {preview && (
        <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
          {/* eslint-disable-next-line @next/next/no-img-element -- external image preview */}
          <img
            src={preview.imageUrl}
            alt="Preview"
            referrerPolicy="no-referrer"
            className="bg-muted max-h-64 w-full rounded-lg object-contain"
            onLoad={(e) =>
              setSize({
                width: e.currentTarget.naturalWidth || null,
                height: e.currentTarget.naturalHeight || null,
              })
            }
            onError={() => setError("That image couldn't be shown. Try a different link.")}
          />
          <div className="space-y-3">
            <FormField id="link-title" label="Title">
              {(a) => (
                <Input
                  {...a}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                />
              )}
            </FormField>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="animate-spin" aria-hidden />} Save pin
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function DiscoverSetup() {
  return (
    <div className="bg-muted/50 space-y-2 rounded-xl p-5 text-sm">
      <p className="font-medium">Discover isn&apos;t switched on yet</p>
      <p className="text-muted-foreground">
        Discover searches millions of free photos on Unsplash. To turn it on, whoever runs this app
        adds a free Unsplash access key as{" "}
        <code className="bg-muted rounded px-1">UNSPLASH_ACCESS_KEY</code> (the README explains
        how). You can still upload photos and save links.
      </p>
    </div>
  );
}

function DiscoverTab({ boardId }: { boardId: string }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState("");
  const [photos, setPhotos] = useState<UnsplashPhoto[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<string | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  async function search(q: string, p: number) {
    if (!q.trim()) return;
    setLoading(true);
    const r = await discoverPhotos(q.trim(), p);
    setLoading(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setActive(q);
    setPage(p);
    setHasMore(r.data.hasMore);
    setPhotos((prev) =>
      p === 1
        ? r.data.photos
        : [...prev, ...r.data.photos.filter((x) => !prev.some((y) => y.id === x.id))],
    );
  }

  // Infinite scroll: fetch the next page when the bottom is visible.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !loading) void search(active, page + 1);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, active, page]);

  async function save(photo: UnsplashPhoto) {
    setSaving(photo.id);
    const r = await addUnsplashPin(boardId, photo.id);
    setSaving(null);
    if (!r.ok) return toast.error(r.error);
    setSaved((s) => new Set(s).add(photo.id));
    toast.success("Saved to your board");
  }

  return (
    <div className="space-y-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void search(query, 1);
        }}
      >
        <Label htmlFor="discover-q" className="sr-only">
          Search ideas
        </Label>
        <Input
          id="discover-q"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. peony bouquet"
          maxLength={80}
        />
        <Button type="submit" variant="secondary" disabled={loading || !query.trim()}>
          <Search aria-hidden /> Search
        </Button>
      </form>
      <div className="flex flex-wrap gap-1.5" aria-label="Ideas">
        {IDEAS.map((idea) => (
          <button
            key={idea}
            type="button"
            onClick={() => {
              setQuery(idea);
              void search(idea, 1);
            }}
            className={cn(
              "focus-visible:ring-ring rounded-full border px-3 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none",
              active === idea
                ? "bg-primary text-primary-foreground border-primary"
                : "hover:bg-accent",
            )}
          >
            {idea}
          </button>
        ))}
      </div>

      {active && !loading && photos.length === 0 && (
        <p className="text-muted-foreground py-6 text-center text-sm">
          No photos found. Try other words.
        </p>
      )}
      <ul className="columns-2 gap-3 sm:columns-3">
        {photos.map((p) => (
          <li key={p.id} className="mb-3 break-inside-avoid">
            <div
              className="relative overflow-hidden rounded-lg"
              style={{ background: p.color ?? undefined }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- Unsplash asks apps to hotlink its images */}
              <img
                src={p.thumb}
                alt={p.alt || "Unsplash photo"}
                loading="lazy"
                className="block w-full"
                style={{ aspectRatio: `${p.width} / ${p.height}` }}
              />
              <Button
                size="sm"
                variant={saved.has(p.id) ? "secondary" : "default"}
                className="absolute right-2 bottom-2 shadow"
                disabled={saving === p.id || saved.has(p.id)}
                onClick={() => save(p)}
                aria-label={saved.has(p.id) ? "Saved" : `Save photo by ${p.photographer}`}
              >
                {saving === p.id ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : saved.has(p.id) ? (
                  <Check aria-hidden />
                ) : null}
                {saved.has(p.id) ? "Saved" : "Save"}
              </Button>
            </div>
            <p className="text-muted-foreground mt-1 truncate text-[0.7rem]">
              Photo by{" "}
              <a href={p.photographerUrl} target="_blank" rel="noreferrer" className="underline">
                {p.photographer}
              </a>{" "}
              on{" "}
              <a href={UNSPLASH_LINK} target="_blank" rel="noreferrer" className="underline">
                Unsplash
              </a>
            </p>
          </li>
        ))}
      </ul>
      {loading && (
        <p className="text-muted-foreground flex items-center justify-center gap-2 py-4 text-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Loading…
        </p>
      )}
      {hasMore && !loading && (
        <div ref={sentinel} className="flex justify-center">
          <Button variant="outline" size="sm" onClick={() => search(active, page + 1)}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
