"use client";

import { useState, useTransition } from "react";
import { Download, Loader2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { toast } from "sonner";
import { deleteMyData, downloadMyData } from "@/app/r/privacy-actions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function DataRights({ code }: { code: string }) {
  const t = useTranslations("rsvp.privacy");
  const [downloading, startDownload] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [deleted, setDeleted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleDownload() {
    startDownload(async () => {
      const r = await downloadMyData(code);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "my-wedding-data.json";
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("downloaded"));
    });
  }

  function handleDelete() {
    startDelete(async () => {
      const r = await deleteMyData(code);
      if (r.ok) {
        setDeleted(true);
        setConfirmOpen(false);
        toast.success(t("deleted"));
      } else {
        toast.error(r.error);
      }
    });
  }

  if (deleted) {
    return (
      <div className="bg-card rounded-2xl border p-5 text-center shadow-sm sm:p-7">
        <p className="font-medium">{t("deletedTitle")}</p>
        <p className="text-muted-foreground mt-1 text-sm">{t("deletedText")}</p>
      </div>
    );
  }

  return (
    <div className="bg-card space-y-4 rounded-2xl border p-5 shadow-sm sm:p-7">
      <h2 className="text-lg font-medium">{t("title")}</h2>
      <p className="text-muted-foreground text-sm">
        {t("description")}{" "}
        <Link href="/privacy" target="_blank" className="underline underline-offset-2 hover:text-foreground">
          {t("privacyLink")}
        </Link>
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          disabled={downloading}
        >
          {downloading ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <Download className="size-4" aria-hidden />
          )}
          {t("download")}
        </Button>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="text-destructive">
              <Trash2 className="size-4" aria-hidden />
              {t("delete")}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="font-serif text-2xl">{t("deleteTitle")}</AlertDialogTitle>
              <AlertDialogDescription>{t("deleteDescription")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>{t("cancel")}</AlertDialogCancel>
              <Button
                variant="destructive"
                disabled={deleting}
                onClick={handleDelete}
              >
                {deleting && <Loader2 className="animate-spin" aria-hidden />}
                {t("confirmDelete")}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
