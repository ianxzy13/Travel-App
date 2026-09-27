"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { parseMoney } from "@/lib/budget/money";
import { cn } from "@/lib/utils";

/**
 * Text box for an amount of money. Accepts "1.234,50", "1,234.50", "800"…
 * and reports a number (or null when empty) when the box loses focus.
 */
export function MoneyInput({
  value,
  onChange,
  currency,
  allowEmpty = false,
  className,
  ...rest
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  currency: string;
  allowEmpty?: boolean;
} & Omit<React.ComponentProps<typeof Input>, "value" | "onChange">) {
  const show = (v: number | null) =>
    v == null ? "" : Number.isInteger(v) ? String(v) : v.toFixed(2);
  const [text, setText] = useState(show(value));
  const [invalid, setInvalid] = useState(false);

  // follow outside changes (e.g. form reset)
  useEffect(() => setText(show(value)), [value]);

  function commit() {
    const parsed = parseMoney(text);
    if (parsed === null) {
      setInvalid(false);
      if (allowEmpty) onChange(null);
      else {
        onChange(0);
        setText("0");
      }
      return;
    }
    if (Number.isNaN(parsed) || parsed < 0) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onChange(parsed);
    setText(show(parsed));
  }

  return (
    <div className={cn("relative", className)}>
      <span className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-xs">
        {currency}
      </span>
      <Input
        inputMode="decimal"
        autoComplete="off"
        {...rest}
        value={text}
        aria-invalid={invalid || rest["aria-invalid"]}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          rest.onKeyDown?.(e);
        }}
        className="ps-12 text-end tabular-nums"
      />
    </div>
  );
}
