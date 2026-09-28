"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { deleteWedding, leaveWedding } from "@/app/app/settings/actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { ActionResult } from "@/lib/action-result";

/** Show an error toast and keep the dialog open; on success the action redirects. */
function handle(result: ActionResult | undefined) {
  if (result && !result.ok) {
    toast.error(result.error);
    return false;
  }
}

export function DangerZone({ isOwner, weddingName }: { isOwner: boolean; weddingName: string }) {
  const t = useTranslations("danger");
  const b = (c: React.ReactNode) => <strong className="text-foreground">{c}</strong>;
  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="font-serif text-2xl">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Row text={t.rich("leaveText", { name: weddingName, b })}>
          <ConfirmDialog
            trigger={<Button variant="outline">{t("leave")}</Button>}
            title={t("leaveTitle")}
            description={t("leaveDialog")}
            confirmLabel={t("leaveConfirm")}
            onConfirm={async () => handle(await leaveWedding())}
          />
        </Row>

        {isOwner && (
          <>
            <Separator />
            <Row text={t.rich("deleteText", { name: weddingName, b })}>
              <ConfirmDialog
                trigger={<Button variant="destructive">{t("delete")}</Button>}
                title={t("deleteTitle")}
                description={t("deleteDialog", { name: weddingName })}
                confirmLabel={t("deleteConfirm")}
                onConfirm={async () => handle(await deleteWedding())}
              />
            </Row>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ text, children }: { text: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-muted-foreground text-sm">{text}</p>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
