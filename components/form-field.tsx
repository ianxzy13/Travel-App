"use client";

import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { validationText } from "@/lib/i18n/validation";
import { cn } from "@/lib/utils";

/** Red helper text under an input (form-check codes are shown in the person's language). */
export function FieldError({ id, message }: { id?: string; message?: string }) {
  const t = useTranslations("validation");
  if (!message) return null;
  return (
    <p id={id} className="text-destructive text-sm">
      {validationText(t as never, message)}
    </p>
  );
}

/** Translates a form-check code (for places that show errors without FieldError). */
export function useValidationText() {
  const t = useTranslations("validation");
  return (message: string | undefined) => validationText(t as never, message);
}

/**
 * Label + input + hint/error, wired up for screen readers.
 * Pass the input as a render function so it receives the right aria props.
 */
export function FormField({
  id,
  label,
  hint,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: (aria: {
    id: string;
    "aria-invalid": boolean;
    "aria-describedby"?: string;
  }) => React.ReactNode;
}) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children({ id, "aria-invalid": !!error, "aria-describedby": describedBy })}
      {error ? (
        <FieldError id={`${id}-error`} message={error} />
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-muted-foreground text-sm">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
