"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { loadHouseholdRsvp, recordRsvp } from "@/app/app/rsvp/actions";
import { RsvpForm } from "@/components/rsvp/rsvp-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { initialFormState, type RsvpFormState } from "@/lib/rsvp/form";
import type { RsvpData } from "@/lib/rsvp/types";

/** Lets the couple fill in (or correct) a household's RSVP, e.g. from a paper card. */
export function RecordReplyDialog({
  household,
  onClose,
}: {
  household: { name: string; code: string } | null;
  onClose: () => void;
}) {
  const [data, setData] = useState<RsvpData | null>(null);
  const [state, setState] = useState<RsvpFormState | null>(null);

  useEffect(() => {
    setData(null);
    setState(null);
    if (!household) return;
    let cancelled = false;
    loadHouseholdRsvp(household.code).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        toast.error(result.error);
        onClose();
        return;
      }
      setData(result.data);
      setState(initialFormState(result.data));
    });
    return () => {
      cancelled = true;
    };
  }, [household, onClose]);

  return (
    <Dialog open={!!household} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">RSVP for {household?.name}</DialogTitle>
          <DialogDescription>
            Record a reply you got by phone, card or message. Deadlines don&apos;t apply to you.
          </DialogDescription>
        </DialogHeader>
        {!data || !state ? (
          <div className="flex justify-center py-12">
            <Loader2 className="text-muted-foreground animate-spin" aria-label="Loading" />
          </div>
        ) : data.invites.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center">
            Nobody in this household is invited to an event yet. Invite them from the Guests page.
          </p>
        ) : (
          <RsvpForm
            data={data}
            state={state}
            onStateChange={setState}
            onSubmit={(payload) => recordRsvp(data.household.code, payload)}
            onSaved={() => {
              toast.success(`RSVP saved for ${data.household.name}`);
              onClose();
            }}
            submitLabel="Save RSVP"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
