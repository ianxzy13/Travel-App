"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createTag, deleteTag, updateTag } from "@/app/app/guests/actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { TagColor } from "@/lib/database.types";
import { cn } from "@/lib/utils";
import { TAG_COLORS } from "@/lib/validation/guest";
import { TAG_COLOR_CLASSES } from "./badges";
import type { TagOption } from "./types";

/** Create, rename, recolour and delete tags. */
export function TagsDialog({
  open,
  onOpenChange,
  tags,
  usage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tags: TagOption[];
  /** tag id → number of guests with that tag */
  usage: Map<string, number>;
}) {
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function add() {
    if (!name.trim()) return;
    startTransition(async () => {
      const result = await createTag({ name: name.trim(), color: "stone" });
      if (result.ok) setName("");
      else toast.error(result.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Tags</DialogTitle>
          <DialogDescription>
            Group guests however you like: family, school friends, work, neighbours…
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New tag name"
            aria-label="New tag name"
            maxLength={40}
          />
          <Button type="submit" disabled={pending || !name.trim()}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
            Add
          </Button>
        </form>

        {tags.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">No tags yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {tags.map((t) => (
              <TagRow key={t.id} tag={t} count={usage.get(t.id) ?? 0} />
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TagRow({ tag, count }: { tag: TagOption; count: number }) {
  const [name, setName] = useState(tag.name);
  const [pending, startTransition] = useTransition();

  function save(update: { name?: string; color?: TagColor }) {
    const next = { name: tag.name, color: tag.color, ...update };
    if (!next.name.trim()) {
      setName(tag.name);
      return;
    }
    startTransition(async () => {
      const result = await updateTag(tag.id, next);
      if (!result.ok) {
        toast.error(result.error);
        setName(tag.name);
      }
    });
  }

  return (
    <li className="space-y-2 p-3">
      <div className="flex items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() !== tag.name && save({ name: name.trim() })}
          aria-label={`Rename tag ${tag.name}`}
          maxLength={40}
          className="h-8"
        />
        <span className="text-muted-foreground w-16 shrink-0 text-right text-xs">
          {count} guest{count === 1 ? "" : "s"}
        </span>
        <ConfirmDialog
          trigger={
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={pending}
              aria-label={`Delete tag ${tag.name}`}
            >
              <Trash2 aria-hidden />
            </Button>
          }
          title={`Delete “${tag.name}”?`}
          description={`It will be removed from ${count} guest${count === 1 ? "" : "s"}. The guests themselves stay.`}
          onConfirm={async () => {
            const result = await deleteTag(tag.id);
            if (!result.ok) {
              toast.error(result.error);
              return false;
            }
          }}
        />
      </div>
      <div role="radiogroup" aria-label={`Colour for ${tag.name}`} className="flex gap-1.5">
        {TAG_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={tag.color === c}
            aria-label={c}
            disabled={pending}
            onClick={() => c !== tag.color && save({ color: c })}
            className={cn(
              "focus-visible:ring-ring size-6 rounded-full focus-visible:ring-2 focus-visible:outline-none",
              TAG_COLOR_CLASSES[c],
              tag.color === c && "ring-foreground ring-2 ring-offset-2",
            )}
          />
        ))}
      </div>
    </li>
  );
}
