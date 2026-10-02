"use client";

import { useState, useTransition } from "react";
import { Check, Copy, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  deleteLayout,
  duplicateLayout,
  renameLayout,
  switchActiveLayout,
} from "@/app/app/seating/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

type Layout = { id: string; name: string; is_active: boolean };

export function ScenarioSwitcher({
  layouts,
  activeId,
  canEdit,
}: {
  layouts: Layout[];
  activeId: string;
  canEdit: boolean;
}) {
  const t = useTranslations("seating.scenarios");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  if (layouts.length <= 1 && !canEdit) return null;

  function label(l: Layout) {
    return l.name || t("defaultName");
  }

  function handleSwitch(id: string) {
    startTransition(async () => {
      const r = await switchActiveLayout(id);
      if (r.ok) {
        toast.success(t("switched"));
        router.refresh();
      }
    });
  }

  function handleDuplicate(l: Layout) {
    startTransition(async () => {
      const name = `${label(l)} (copy)`;
      const r = await duplicateLayout(l.id, name);
      if (r.ok) {
        toast.success(t("duplicated"));
        router.refresh();
      }
    });
  }

  function startRename(l: Layout) {
    setRenaming(l.id);
    setRenameDraft(l.name);
  }

  function submitRename() {
    if (!renaming || !renameDraft.trim()) return;
    const id = renaming;
    setRenaming(null);
    startTransition(async () => {
      const r = await renameLayout(id, renameDraft.trim());
      if (r.ok) router.refresh();
    });
  }

  function confirmDelete() {
    if (!deleting) return;
    const id = deleting;
    setDeleting(null);
    startTransition(async () => {
      const r = await deleteLayout(id);
      if (r.ok) {
        toast.success(t("deleted"));
        router.refresh();
      }
    });
  }

  return (
    <div className="flex items-center gap-1">
      {layouts.map((l) => (
        <div key={l.id} className="flex items-center gap-0.5">
          {renaming === l.id ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitRename();
              }}
              className="flex items-center gap-1"
            >
              <Input
                className="h-7 w-28 text-xs"
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                autoFocus
                onBlur={submitRename}
              />
            </form>
          ) : (
            <Button
              variant={l.id === activeId ? "secondary" : "ghost"}
              size="sm"
              className="h-7 gap-1 text-xs"
              disabled={pending || l.id === activeId}
              onClick={() => handleSwitch(l.id)}
            >
              {l.id === activeId && <Check className="size-3" aria-hidden />}
              {label(l)}
              {l.is_active && <span className="text-primary text-[10px]">{t("active")}</span>}
            </Button>
          )}
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="size-6 p-0">
                  <MoreHorizontal className="size-3" aria-hidden />
                  <span className="sr-only">{label(l)}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => startRename(l)}>
                  <Pencil className="size-3.5" aria-hidden /> {t("rename")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDuplicate(l)} disabled={layouts.length >= 3}>
                  <Copy className="size-3.5" aria-hidden /> {t("duplicate")}
                </DropdownMenuItem>
                {layouts.length > 1 && (
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => setDeleting(l.id)}
                  >
                    <Trash2 className="size-3.5" aria-hidden /> {t("delete")}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      ))}
      {canEdit && layouts.length < 3 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          disabled={pending}
          onClick={() => {
            const active = layouts.find((l) => l.id === activeId);
            if (active) handleDuplicate(active);
          }}
        >
          + {t("plan")}
        </Button>
      )}
      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteConfirm")}</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
