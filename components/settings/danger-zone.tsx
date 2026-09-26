"use client";

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
  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="font-serif text-2xl">Danger zone</CardTitle>
        <CardDescription>These actions can&apos;t be undone.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Row
          text={
            <>
              Stop collaborating on <strong className="text-foreground">{weddingName}</strong>.
              You&apos;ll need a new invitation to rejoin.
            </>
          }
        >
          <ConfirmDialog
            trigger={<Button variant="outline">Leave wedding</Button>}
            title="Leave this wedding?"
            description="You'll lose access immediately. An owner can invite you again later."
            confirmLabel="Leave"
            onConfirm={async () => handle(await leaveWedding())}
          />
        </Row>

        {isOwner && (
          <>
            <Separator />
            <Row
              text={
                <>
                  Permanently delete <strong className="text-foreground">{weddingName}</strong> and
                  everything in it, for all collaborators.
                </>
              }
            >
              <ConfirmDialog
                trigger={<Button variant="destructive">Delete wedding</Button>}
                title="Delete this wedding?"
                description={`All guests, budgets, seating charts and other data for ${weddingName} will be permanently deleted for everyone. This can't be undone.`}
                confirmLabel="Delete forever"
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
