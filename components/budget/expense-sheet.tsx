"use client";

import { useTransition } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteExpense, saveExpense } from "@/app/app/budget/actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FileField } from "@/components/files/file-field";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
import type { VendorSummary } from "@/lib/budget/load";
import { formatMoney, sumMoney } from "@/lib/budget/money";
import type { BudgetCategory, BudgetExpense, BudgetPayment } from "@/lib/budget/stats";
import { expenseSchema, type ExpenseValues } from "@/lib/validation/budget";
import { MoneyInput } from "./money-input";

export type ExpenseSheetMode =
  { kind: "new"; categoryId?: string } | { kind: "edit"; expense: BudgetExpense } | null;

type Props = {
  mode: ExpenseSheetMode;
  onClose: () => void;
  weddingId: string;
  currency: string;
  categories: BudgetCategory[];
  vendors: VendorSummary[];
  payments: BudgetPayment[];
  readOnly: boolean;
};

export function ExpenseSheet(props: Props) {
  const key = props.mode
    ? props.mode.kind === "edit"
      ? props.mode.expense.id
      : `new-${props.mode.categoryId}`
    : "none";
  return (
    <Sheet open={!!props.mode} onOpenChange={(o) => !o && props.onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        {props.mode && <ExpenseForm key={key} {...props} mode={props.mode} />}
      </SheetContent>
    </Sheet>
  );
}

function ExpenseForm({
  mode,
  onClose,
  weddingId,
  currency,
  categories,
  vendors,
  payments,
  readOnly,
}: Props & { mode: NonNullable<ExpenseSheetMode> }) {
  const editing = mode.kind === "edit" ? mode.expense : null;
  const [pending, startTransition] = useTransition();

  const defaults: ExpenseValues = editing
    ? {
        categoryId: editing.categoryId,
        vendorId: editing.vendorId,
        name: editing.name,
        estimated: editing.estimated,
        actual: editing.actual,
        notes: editing.notes ?? "",
        receipt: editing.receiptPath
          ? { path: editing.receiptPath, name: editing.receiptName ?? "Receipt" }
          : null,
        payments: payments
          .filter((p) => p.expenseId === editing.id)
          .map((p) => ({
            amount: p.amount,
            dueDate: p.dueDate ?? "",
            paid: p.paid,
            paidOn: p.paidOn ?? "",
            note: p.note ?? "",
          })),
      }
    : {
        categoryId: (mode.kind === "new" && mode.categoryId) || categories[0]?.id || "",
        vendorId: null,
        name: "",
        estimated: 0,
        actual: null,
        notes: "",
        receipt: null,
        payments: [],
      };

  const form = useForm({ resolver: zodResolver(expenseSchema), defaultValues: defaults });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "payments" });
  const { errors } = form.formState;

  const watched = form.watch();
  const cost = watched.actual ?? watched.estimated ?? 0;
  const paid = sumMoney(watched.payments.filter((p) => p.paid).map((p) => p.amount));
  const scheduled = sumMoney(watched.payments.map((p) => p.amount));
  const money = (v: number) => formatMoney(v, currency);

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await saveExpense(values, editing?.id);
      if (result.ok) {
        toast.success(editing ? "Expense saved" : "Expense added");
        onClose();
      } else toast.error(result.error);
    }),
  );

  return (
    <>
      <SheetHeader className="border-b px-6 py-4">
        <SheetTitle className="font-serif text-3xl">
          {editing ? editing.name : "Add an expense"}
        </SheetTitle>
        <SheetDescription>
          Use the estimate while you&apos;re planning; add the actual price once it&apos;s agreed.
        </SheetDescription>
      </SheetHeader>

      <form
        id="expense-form"
        onSubmit={onSubmit}
        className="flex-1 space-y-6 overflow-y-auto px-6 py-6"
        noValidate
      >
        <fieldset disabled={readOnly || pending} className="space-y-6">
          <FormField id="e-name" label="What is it?" error={errors.name?.message}>
            {(aria) => <Input {...aria} placeholder="e.g. Venue hire" {...form.register("name")} />}
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="e-cat" label="Category" error={errors.categoryId?.message}>
              {(aria) => (
                <Controller
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger {...aria} className="w-full">
                        <SelectValue placeholder="Choose…" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </FormField>
            <FormField id="e-vendor" label="Vendor">
              {(aria) => (
                <Controller
                  control={form.control}
                  name="vendorId"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? "none"}
                      onValueChange={(v) => field.onChange(v === "none" ? null : v)}
                    >
                      <SelectTrigger {...aria} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No vendor</SelectItem>
                        {vendors.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </FormField>
            <FormField id="e-est" label="Estimated cost" error={errors.estimated?.message}>
              {(aria) => (
                <Controller
                  control={form.control}
                  name="estimated"
                  render={({ field }) => (
                    <MoneyInput
                      {...aria}
                      currency={currency}
                      value={field.value}
                      onChange={(v) => field.onChange(v ?? 0)}
                    />
                  )}
                />
              )}
            </FormField>
            <FormField
              id="e-act"
              label="Actual cost"
              hint="Leave empty until you know it."
              error={errors.actual?.message}
            >
              {(aria) => (
                <Controller
                  control={form.control}
                  name="actual"
                  render={({ field }) => (
                    <MoneyInput
                      {...aria}
                      currency={currency}
                      allowEmpty
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              )}
            </FormField>
          </div>

          {/* ---------- payment schedule ---------- */}
          <section className="space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-xl">Payments</h3>
              <p className="text-muted-foreground text-xs tabular-nums">
                Paid {money(paid)} of {money(cost)}
                {scheduled !== cost && cost > 0 && ` · ${money(scheduled)} scheduled`}
              </p>
            </div>
            {fields.length === 0 && (
              <p className="text-muted-foreground text-sm">
                Add deposits and instalments with their due dates. You&apos;ll see upcoming ones on
                the budget page.
              </p>
            )}
            <ul className="space-y-2">
              {fields.map((f, i) => (
                <li
                  key={f.id}
                  className="grid grid-cols-[1fr_auto] gap-2 rounded-lg border p-3 sm:grid-cols-[8rem_9.5rem_1fr_auto]"
                >
                  <Controller
                    control={form.control}
                    name={`payments.${i}.amount`}
                    render={({ field }) => (
                      <MoneyInput
                        currency={currency}
                        value={field.value}
                        onChange={(v) => field.onChange(v ?? 0)}
                        aria-label={`Payment ${i + 1} amount`}
                        aria-invalid={!!errors.payments?.[i]?.amount}
                      />
                    )}
                  />
                  <Input
                    type="date"
                    aria-label={`Payment ${i + 1} due date`}
                    className="max-sm:col-start-1"
                    {...form.register(`payments.${i}.dueDate`)}
                  />
                  <Input
                    placeholder="Note (e.g. deposit)"
                    aria-label={`Payment ${i + 1} note`}
                    className="max-sm:col-span-2"
                    {...form.register(`payments.${i}.note`)}
                  />
                  <div className="flex items-center gap-2 max-sm:col-start-2 max-sm:row-start-1">
                    <Controller
                      control={form.control}
                      name={`payments.${i}.paid`}
                      render={({ field }) => (
                        <label className="flex items-center gap-1.5 text-sm">
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={(c) => field.onChange(c === true)}
                          />
                          Paid
                        </label>
                      )}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => remove(i)}
                      aria-label={`Remove payment ${i + 1}`}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                  {errors.payments?.[i]?.amount && (
                    <p className="text-destructive col-span-full text-xs">
                      {errors.payments[i]?.amount?.message}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  append({
                    amount: Math.max(0, Math.round((cost - scheduled) * 100) / 100) || 0,
                    dueDate: "",
                    paid: false,
                    paidOn: "",
                    note: "",
                  })
                }
              >
                <Plus aria-hidden /> Add payment
              </Button>
              {fields.length === 0 && cost > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    append({
                      amount: cost,
                      dueDate: "",
                      paid: true,
                      paidOn: "",
                      note: "Paid in full",
                    })
                  }
                >
                  Mark as paid in full
                </Button>
              )}
            </div>
          </section>

          <FormField id="e-notes" label="Notes" error={errors.notes?.message}>
            {(aria) => <Textarea {...aria} rows={3} {...form.register("notes")} />}
          </FormField>

          <div className="space-y-2">
            <p className="text-sm font-medium">Receipt or invoice</p>
            <Controller
              control={form.control}
              name="receipt"
              render={({ field }) => (
                <FileField
                  weddingId={weddingId}
                  folder="receipts"
                  value={field.value}
                  onChange={field.onChange}
                  disabled={readOnly}
                  label="Upload receipt"
                />
              )}
            />
          </div>
        </fieldset>
      </form>

      {!readOnly && (
        <SheetFooter className="flex-row flex-wrap items-center gap-2 border-t px-6 py-4">
          {editing && (
            <ConfirmDialog
              trigger={
                <Button variant="ghost" className="text-destructive mr-auto" disabled={pending}>
                  <Trash2 aria-hidden /> Delete
                </Button>
              }
              title={`Delete “${editing.name}”?`}
              description="Its payments and receipt will be deleted too."
              onConfirm={async () => {
                const r = await deleteExpense(editing.id);
                if (!r.ok) {
                  toast.error(r.error);
                  return false;
                }
                toast.success("Expense deleted");
                onClose();
              }}
            />
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" form="expense-form" disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              {editing ? "Save" : "Add expense"}
            </Button>
          </div>
        </SheetFooter>
      )}
    </>
  );
}
