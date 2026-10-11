"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Plane, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Airport } from "@/lib/places/airports";

type Props = {
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
};

function countryEmoji(cc: string): string {
  if (cc.length !== 2) return "";
  const offset = 0x1f1e6 - 65;
  const a = cc.codePointAt(0)!;
  const b = cc.codePointAt(1)!;
  return String.fromCodePoint(a + offset) + String.fromCodePoint(b + offset);
}

export function AirportCombobox({
  value,
  onChange,
  placeholder,
  id,
  disabled,
  className,
}: Props) {
  const listId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Airport[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [label, setLabel] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!value) { setLabel(""); return; }
    let cancelled = false;
    import("@/lib/places/airports").then(({ airportByCode }) =>
      airportByCode(value).then((a) => {
        if (cancelled) return;
        setLabel(a ? `${a.city} (${a.code})` : value);
      }),
    ).catch(() => {});
    return () => { cancelled = true; };
  }, [value]);

  const positionDropdown = useCallback(() => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  const search = useCallback((q: string) => {
    clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      import("@/lib/places/airports").then(({ searchAirports }) =>
        searchAirports(q, { limit: 8 }).then((r) => {
          setResults(r);
          setOpen(true);
          setActive(-1);
          positionDropdown();
        }),
      ).catch(() => {});
    }, 100);
  }, [positionDropdown]);

  function pick(airport: Airport) {
    onChange(airport.code);
    setLabel(`${airport.city} (${airport.code})`);
    setQuery("");
    setOpen(false);
    setResults([]);
    inputRef.current?.blur();
  }

  function clear() {
    onChange("");
    setLabel("");
    setQuery("");
    setResults([]);
    setOpen(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((p) => Math.min(p + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((p) => Math.max(p - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && results[active]) pick(results[active]);
      else if (results.length > 0) pick(results[0]);
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Tab" && active >= 0 && results[active]) {
      pick(results[active]);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    setLabel("");
    onChange("");
    search(v);
  }

  function handleFocus() {
    if (label) return;
    if (query.trim().length >= 2) search(query);
  }

  useEffect(() => {
    if (active < 0 || !listRef.current) return;
    const el = listRef.current.children[active] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        !wrapperRef.current?.contains(target) &&
        !listRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleScroll() {
      positionDropdown();
    }
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleScroll);
    };
  }, [open, positionDropdown]);

  const showClear = !!(label || query);

  const dropdown = open && (
    <div
      ref={listRef}
      id={listId}
      role="listbox"
      style={dropdownStyle}
      className="bg-popover z-[100] max-h-64 overflow-auto rounded-md border shadow-md"
    >
      {results.length === 0 ? (
        <p className="text-muted-foreground px-3 py-3 text-center text-sm">
          No airports found. Try the city name.
        </p>
      ) : (
        results.map((a, i) => (
          <div
            key={a.code}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            className={cn(
              "flex cursor-pointer items-center gap-2 px-3 py-2.5 text-sm transition-colors",
              i === active
                ? "bg-accent text-accent-foreground"
                : "hover:bg-muted",
            )}
            onMouseEnter={() => setActive(i)}
            onMouseDown={(e) => {
              e.preventDefault();
              pick(a);
            }}
          >
            <span className="shrink-0 text-base leading-none">
              {countryEmoji(a.countryCode)}
            </span>
            <span className="min-w-0 flex-1 truncate">
              <span className="font-medium">{a.name}</span>
              <span className="text-muted-foreground">
                {" · "}
                {a.city}, {a.country}
              </span>
            </span>
            <span className="bg-muted shrink-0 rounded px-1.5 py-0.5 font-mono text-xs font-medium">
              {a.code}
            </span>
          </div>
        ))
      )}
    </div>
  );

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <Plane className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />
      <Input
        ref={inputRef}
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        value={label || query}
        onChange={handleChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        className={cn("pl-8", showClear && "pr-8")}
      />
      {showClear && !disabled && (
        <button
          type="button"
          onClick={clear}
          className="text-muted-foreground hover:text-foreground absolute right-2 top-1/2 -translate-y-1/2 p-0.5"
          tabIndex={-1}
          aria-label="Clear"
        >
          <X className="size-3.5" />
        </button>
      )}
      {typeof document !== "undefined" && dropdown
        ? createPortal(dropdown, document.body)
        : dropdown}
    </div>
  );
}
