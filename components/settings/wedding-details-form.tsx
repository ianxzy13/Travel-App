"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateWedding } from "@/app/app/settings/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  DateLocationFields,
  GuestsCurrencyFields,
  NamesFields,
  StyleFields,
} from "@/components/wedding/wedding-fields";
import { weddingSchema, type WeddingFormValues } from "@/lib/validation/wedding";

export function WeddingDetailsForm({
  defaultValues,
  readOnly,
}: {
  defaultValues: WeddingFormValues;
  readOnly: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const form = useForm({ resolver: zodResolver(weddingSchema), defaultValues });

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await updateWedding(values);
      if (result.ok) {
        toast.success("Wedding details saved");
        form.reset(values); // clears the "unsaved changes" state
      } else {
        toast.error(result.error);
      }
    }),
  );

  const disabled = readOnly || pending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-2xl">Wedding details</CardTitle>
        <CardDescription>
          {readOnly
            ? "You have view-only access. Ask an owner if you need to make changes."
            : "Names, date, location and style. Changes apply everywhere in the app."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-6" noValidate>
          <NamesFields form={form} disabled={disabled} />
          <DateLocationFields form={form} disabled={disabled} />
          <GuestsCurrencyFields form={form} disabled={disabled} />
          <Separator />
          <StyleFields form={form} disabled={disabled} />
          {!readOnly && (
            <div className="flex justify-end">
              <Button type="submit" disabled={pending || !form.formState.isDirty}>
                {pending && <Loader2 className="animate-spin" aria-hidden />}
                Save changes
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
