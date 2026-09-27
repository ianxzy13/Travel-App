"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("guests.tagsDialog");
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
          <DialogTitle className="font-serif text-2xl">{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
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
            placeholder={t("newTag")}
            aria-label={t("newTag")}
            maxLength={40}
          />
          <Button type="submit" disabled={pending || !name.trim()}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
            {t("add")}
          </Button>
        </form>

        {tags.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">{t("empty")}</p>
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
  const t = useTranslations("guests.tagsDialog");
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
          aria-label={t("rename", { name: tag.name })}
          maxLength={40}
          className="h-8"
        />
        <span className="text-muted-foreground w-20 shrink-0 text-end text-xs">
          {t("count", { count })}
        </span>
        <ConfirmDialog
          trigger={
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={pending}
              aria-label={t("delete", { name: tag.name })}
            >
              <Trash2 aria-hidden />
            </Button>
          }
          title={t("deleteTitle", { name: tag.name })}
          description={t("deleteText", { count })}
          onConfirm={async () => {
            const result = await deleteTag(tag.id);
            if (!result.ok) {
              toast.error(result.error);
              return false;
            }
          }}
        />
      </div>
      <div role="radiogroup" aria-label={t("colour", { name: tag.name })} className="flex gap-1.5">
        {TAG_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={tag.color === c}
            aria-label={t(`colours.${c}`)}
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
