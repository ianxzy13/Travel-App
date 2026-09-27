"use client";

import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteScheduleItem, saveScheduleItem } from "@/app/app/schedule/actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { ScheduleItemRow } from "@/lib/database.types";
import { scheduleItemSchema, type ScheduleItemValues } from "@/lib/validation/tasks";

const NONE = "none";

export function ItemSheet({
  open,
  item,
  day,
  defaultStart,
  vendors,
  canEdit,
  onOpenChange,
}: {
  open: boolean;
  item: ScheduleItemRow | null;
  /** "YYYY-MM-DD" of the day being planned ("" if the wedding date isn't set) */
  day: string;
  defaultStart: string;
  vendors: { id: string; name: string }[];
  canEdit: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const form = useForm<ScheduleItemValues>({
    resolver: zodResolver(scheduleItemSchema),
    defaultValues: {
      day: "",
      start_time: "",
      duration_min: "",
      title: "",
      location: "",
      owner: "",
      notes: "",
      vendor_id: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      day,
      start_time: item?.start_time.slice(0, 5) ?? defaultStart,
      duration_min: item?.duration_min != null ? String(item.duration_min) : "30",
      title: item?.title ?? "",
      location: item?.location ?? "",
      owner: item?.owner ?? "",
      notes: item?.notes ?? "",
      vendor_id: item?.vendor_id ?? "",
    });
  }, [open, item, day, defaultStart, form]);

  const submit = form.handleSubmit((values) =>
    startTransition(async () => {
      const r = await saveScheduleItem(item?.id ?? null, values);
      if (!r.ok) return void toast.error(r.error);
      toast.success(item ? "Saved" : "Added to the schedule");
      onOpenChange(false);
    }),
  );
  const errors = form.formState.errors;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <form onSubmit={submit} className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle>
              {item ? (canEdit ? "Edit item" : "Schedule item") : "Add to the schedule"}
            </SheetTitle>
            <SheetDescription>
              What happens, when, where, and who&apos;s in charge.
            </SheetDescription>
          </SheetHeader>
          <fieldset disabled={!canEdit} className="flex-1 space-y-4 px-4">
            <FormField id="item-title" label="What" error={errors.title?.message}>
              {(a) => (
                <Input
                  {...a}
                  {...form.register("title")}
                  maxLength={150}
                  placeholder="e.g. First dance"
                  autoFocus={!item}
                />
              )}
            </FormField>
            <div className="grid grid-cols-3 gap-3">
              <FormField id="item-start" label="Starts" error={errors.start_time?.message}>
                {(a) => <Input {...a} type="time" {...form.register("start_time")} />}
              </FormField>
              <FormField id="item-duration" label="Minutes" error={errors.duration_min?.message}>
                {(a) => (
                  <Input
                    {...a}
                    type="number"
                    min={0}
                    max={1440}
                    step={5}
                    inputMode="numeric"
                    {...form.register("duration_min")}
                  />
                )}
              </FormField>
              <FormField id="item-day" label="Day" error={errors.day?.message}>
                {(a) => <Input {...a} type="date" {...form.register("day")} />}
              </FormField>
            </div>
            <FormField id="item-location" label="Where">
              {(a) => <Input {...a} {...form.register("location")} maxLength={200} />}
            </FormField>
            <FormField
              id="item-owner"
              label="Who's in charge"
              hint="e.g. Photographer, or Anna (maid of honour)"
            >
              {(a) => <Input {...a} {...form.register("owner")} maxLength={120} />}
            </FormField>
            <div className="space-y-2">
              <Label htmlFor="item-vendor">Vendor (their phone shows on the print-out)</Label>
              <Select
                value={form.watch("vendor_id") || NONE}
                onValueChange={(v) =>
                  form.setValue("vendor_id", v === NONE ? "" : v, { shouldDirty: true })
                }
                disabled={!canEdit}
              >
                <SelectTrigger id="item-vendor" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <FormField id="item-notes" label="Notes">
              {(a) => (
                <Textarea
                  {...a}
                  {...form.register("notes")}
                  rows={4}
                  maxLength={2000}
                  placeholder="e.g. Song: At Last – Etta James"
                />
              )}
            </FormField>
          </fieldset>
          {canEdit && (
            <SheetFooter className="flex-row justify-between gap-2">
              {item ? (
                <ConfirmDialog
                  trigger={
                    <Button type="button" variant="ghost" className="text-destructive">
                      <Trash2 aria-hidden /> Delete
                    </Button>
                  }
                  title="Remove from the schedule?"
                  description={item.title}
                  onConfirm={async () => {
                    const r = await deleteScheduleItem(item.id);
                    if (!r.ok) {
                      toast.error(r.error);
                      return false;
                    }
                    onOpenChange(false);
                  }}
                />
              ) : (
                <span />
              )}
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" aria-hidden />}{" "}
                {item ? "Save" : "Add"}
              </Button>
            </SheetFooter>
          )}
        </form>
      </SheetContent>
    </Sheet>
  );
}
