"use client";

import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteTask, saveTask } from "@/app/app/tasks/actions";
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
import type { TaskRow } from "@/lib/database.types";
import { taskSchema, type TaskValues } from "@/lib/validation/tasks";

const NOBODY = "nobody";

export function TaskSheet({
  open,
  task,
  members,
  categories,
  canEdit,
  onOpenChange,
}: {
  open: boolean;
  /** null = new to-do */
  task: TaskRow | null;
  members: { id: string; name: string }[];
  categories: string[];
  canEdit: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const form = useForm<TaskValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: { title: "", notes: "", due_date: "", assignee_id: "", category: "" },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      title: task?.title ?? "",
      notes: task?.notes ?? "",
      due_date: task?.due_date ?? "",
      assignee_id: task?.assignee_id ?? "",
      category: task?.category ?? "",
    });
  }, [open, task, form]);

  const submit = form.handleSubmit((values) =>
    startTransition(async () => {
      const r = await saveTask(task?.id ?? null, values);
      if (!r.ok) return void toast.error(r.error);
      toast.success(task ? "To-do saved" : "To-do added");
      onOpenChange(false);
    }),
  );
  const errors = form.formState.errors;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <form onSubmit={submit} className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle>{task ? (canEdit ? "Edit to-do" : "To-do") : "New to-do"}</SheetTitle>
            <SheetDescription>Give it a due date and a person, so nothing slips.</SheetDescription>
          </SheetHeader>
          <fieldset disabled={!canEdit} className="flex-1 space-y-4 px-4">
            <FormField id="task-title" label="What needs doing?" error={errors.title?.message}>
              {(a) => (
                <Input {...a} {...form.register("title")} maxLength={200} autoFocus={!task} />
              )}
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField id="task-due" label="Due date" error={errors.due_date?.message}>
                {(a) => <Input {...a} type="date" {...form.register("due_date")} />}
              </FormField>
              <div className="space-y-2">
                <Label htmlFor="task-assignee">Who</Label>
                <Select
                  value={form.watch("assignee_id") || NOBODY}
                  onValueChange={(v) =>
                    form.setValue("assignee_id", v === NOBODY ? "" : v, { shouldDirty: true })
                  }
                  disabled={!canEdit}
                >
                  <SelectTrigger id="task-assignee" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NOBODY}>Nobody yet</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <FormField
              id="task-category"
              label="Category (optional)"
              hint="e.g. Guests, Vendors, Attire"
            >
              {(a) => (
                <Input
                  {...a}
                  {...form.register("category")}
                  maxLength={40}
                  list="task-categories"
                />
              )}
            </FormField>
            <datalist id="task-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <FormField id="task-notes" label="Notes">
              {(a) => <Textarea {...a} {...form.register("notes")} rows={5} maxLength={4000} />}
            </FormField>
          </fieldset>
          {canEdit && (
            <SheetFooter className="flex-row justify-between gap-2">
              {task ? (
                <ConfirmDialog
                  trigger={
                    <Button type="button" variant="ghost" className="text-destructive">
                      <Trash2 aria-hidden /> Delete
                    </Button>
                  }
                  title="Delete this to-do?"
                  description={task.title}
                  onConfirm={async () => {
                    const r = await deleteTask(task.id);
                    if (!r.ok) {
                      toast.error(r.error);
                      return false;
                    }
                    toast.success("To-do deleted");
                    onOpenChange(false);
                  }}
                />
              ) : (
                <span />
              )}
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" aria-hidden />}{" "}
                {task ? "Save" : "Add to-do"}
              </Button>
            </SheetFooter>
          )}
        </form>
      </SheetContent>
    </Sheet>
  );
}
