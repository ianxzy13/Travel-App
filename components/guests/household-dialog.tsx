"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateHousehold } from "@/app/app/guests/actions";
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
import { householdSchema } from "@/lib/validation/guest";
import type { HouseholdOption } from "./types";

/** Rename a household and edit its mailing address. */
export function HouseholdDialog({
  household,
  onClose,
}: {
  household: HouseholdOption | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!household} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        {household && <HouseholdForm key={household.id} household={household} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function HouseholdForm({
  household,
  onClose,
}: {
  household: HouseholdOption;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const form = useForm({
    resolver: zodResolver(householdSchema),
    defaultValues: { name: household.name, address: household.address },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await updateHousehold(household.id, values);
      if (result.ok) {
        toast.success("Household saved");
        onClose();
      } else {
        toast.error(result.error);
      }
    }),
  );

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-serif text-2xl">Edit household</DialogTitle>
        <DialogDescription>One invitation and RSVP link goes to each household.</DialogDescription>
      </DialogHeader>
      <form
        id="household-form"
        onSubmit={onSubmit}
        className="grid gap-4 sm:grid-cols-2"
        noValidate
      >
        <FormField
          id="h-name"
          label="Household name"
          error={errors.name?.message}
          className="sm:col-span-2"
        >
          {(aria) => <Input {...aria} {...form.register("name")} />}
        </FormField>
        <FormField
          id="h-1"
          label="Address line 1"
          error={errors.address?.line1?.message}
          className="sm:col-span-2"
        >
          {(aria) => <Input {...aria} {...form.register("address.line1")} />}
        </FormField>
        <FormField
          id="h-2"
          label="Address line 2"
          error={errors.address?.line2?.message}
          className="sm:col-span-2"
        >
          {(aria) => <Input {...aria} {...form.register("address.line2")} />}
        </FormField>
        <FormField id="h-city" label="City" error={errors.address?.city?.message}>
          {(aria) => <Input {...aria} {...form.register("address.city")} />}
        </FormField>
        <FormField id="h-region" label="State / region" error={errors.address?.region?.message}>
          {(aria) => <Input {...aria} {...form.register("address.region")} />}
        </FormField>
        <FormField id="h-zip" label="Postal code" error={errors.address?.postalCode?.message}>
          {(aria) => <Input {...aria} {...form.register("address.postalCode")} />}
        </FormField>
        <FormField id="h-country" label="Country" error={errors.address?.country?.message}>
          {(aria) => <Input {...aria} {...form.register("address.country")} />}
        </FormField>
      </form>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" form="household-form" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          Save
        </Button>
      </DialogFooter>
    </>
  );
}
