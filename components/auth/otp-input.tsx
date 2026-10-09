"use client";

import { useRef, useCallback, type KeyboardEvent, type ClipboardEvent } from "react";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  error?: boolean;
};

export function OtpInput({ value, onChange, length = 6, disabled, error }: Props) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(length, "").split("").slice(0, length);

  const focus = useCallback((i: number) => {
    if (i >= 0 && i < length) refs.current[i]?.focus();
  }, [length]);

  function handleInput(i: number, char: string) {
    const digit = char.replace(/\D/g, "").slice(0, 1);
    if (!digit) return;
    const next = digits.map((d, j) => (j === i ? digit : d)).join("").replace(/ /g, "");
    onChange(next);
    focus(i + 1);
  }

  function handleKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[i]?.trim()) {
        const next = digits.map((d, j) => (j === i ? "" : d)).join("").replace(/ /g, "");
        onChange(next);
      } else {
        const next = digits.map((d, j) => (j === i - 1 ? "" : d)).join("").replace(/ /g, "");
        onChange(next);
        focus(i - 1);
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focus(i - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      focus(i + 1);
    }
  }

  function handlePaste(e: ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (pasted) {
      onChange(pasted);
      focus(Math.min(pasted.length, length - 1));
    }
  }

  return (
    <div className="flex justify-center gap-2" onPaste={handlePaste}>
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          value={digit.trim()}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
          aria-invalid={error}
          onChange={(e) => handleInput(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          className={cn(
            "border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring flex h-12 w-10 items-center justify-center rounded-md border text-center font-mono text-xl shadow-sm transition focus:ring-2 focus:outline-none sm:h-14 sm:w-12 sm:text-2xl",
            error && "border-destructive focus:ring-destructive",
          )}
        />
      ))}
    </div>
  );
}
