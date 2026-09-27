"use client";

import { useEffect, useState, useTransition } from "react";
import { Copy, ExternalLink, Loader2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  createBoard,
  deleteBoard,
  setBoardSharing,
  updateBoard,
} from "@/app/app/inspiration/actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormField } from "@/components/form-field";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { BoardView } from "@/lib/inspiration/load";

/** Create a board (board = null) or rename / delete one. */
export function BoardDialog({
  open,
  board,
  onOpenChange,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  board: BoardView | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (id: string) => void;
  onDeleted: () => void;
}) {
  const t = useTranslations("inspiration.board");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setName(board?.name ?? "");
    setDescription(board?.description ?? "");
    setError(undefined);
  }, [open, board]);

  function save(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const values = { name, description };
      let id = board?.id;
      if (board) {
        const r = await updateBoard(board.id, values);
        if (!r.ok) return setError(r.error);
      } else {
        const r = await createBoard(values);
        if (!r.ok) return setError(r.error);
        id = r.data?.id;
      }
      toast.success(board ? t("saved") : t("created"));
      onSaved(id ?? "all");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={save} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{board ? t("editTitle") : t("newTitle")}</DialogTitle>
            <DialogDescription>{t("hint")}</DialogDescription>
          </DialogHeader>
          <FormField id="board-name" label={t("name")} error={error}>
            {(a) => (
              <Input
                {...a}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                autoFocus
                required
              />
            )}
          </FormField>
          <FormField id="board-description" label={t("description")}>
            {(a) => (
              <Textarea
                {...a}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={300}
                rows={2}
              />
            )}
          </FormField>
          <DialogFooter className="gap-2 sm:justify-between">
            {board ? (
              <ConfirmDialog
                trigger={
                  <Button type="button" variant="ghost" className="text-destructive">
                    <Trash2 aria-hidden /> {t("delete")}
                  </Button>
                }
                title={t("deleteTitle", { name: board.name })}
                description={t("deleteText", { count: board.count })}
                onConfirm={async () => {
                  const r = await deleteBoard(board.id);
                  if (!r.ok) {
                    toast.error(r.error);
                    return false;
                  }
                  toast.success(t("deleted"));
                  onOpenChange(false);
                  onDeleted();
                }}
              />
            ) : (
              <span />
            )}
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}{" "}
              {board ? t("save") : t("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Turn a board's public, read-only link on or off. */
export function ShareDialog({
  board,
  canEdit,
  onOpenChange,
}: {
  board: BoardView | null;
  canEdit: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("inspiration.shareDialog");
  const [shareId, setShareId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  useEffect(() => setShareId(board?.shareId ?? null), [board]);
  const link =
    shareId && typeof window !== "undefined" ? `${window.location.origin}/b/${shareId}` : "";

  function toggle(on: boolean) {
    if (!board) return;
    startTransition(async () => {
      const r = await setBoardSharing(board.id, on);
      if (!r.ok) return void toast.error(r.error);
      setShareId(r.data?.shareId ?? null);
      toast.success(on ? t("created") : t("off"));
    });
  }

  return (
    <Dialog open={!!board} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title", { name: board?.name ?? "" })}</DialogTitle>
          <DialogDescription>{t("text")}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <Label htmlFor="share-switch">{t("toggle")}</Label>
          <Switch
            id="share-switch"
            checked={!!shareId}
            onCheckedChange={toggle}
            disabled={pending || !canEdit}
          />
        </div>
        {shareId && (
          <div className="space-y-2">
            <Label htmlFor="share-link">{t("link")}</Label>
            <div className="flex gap-2">
              <Input
                id="share-link"
                readOnly
                value={link}
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button
                variant="outline"
                size="icon"
                aria-label={t("copy")}
                onClick={() =>
                  navigator.clipboard?.writeText(link).then(() => toast.success(t("copied")))
                }
              >
                <Copy aria-hidden />
              </Button>
              <Button asChild variant="outline" size="icon">
                <a href={link} target="_blank" rel="noreferrer" aria-label={t("open")}>
                  <ExternalLink aria-hidden />
                </a>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
