"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Flag } from "@/components/flag";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LOCALES, localeInfo } from "@/i18n/locales";

export function LanguageMultiSelect({
  value,
  onChange,
  featured = [],
}: {
  value: string[];
  onChange: (codes: string[]) => void;
  featured?: readonly string[];
}) {
  const t = useTranslations("guests.sheet");
  const first = LOCALES.filter((l) => featured.includes(l.code) && !value.includes(l.code));
  const rest = LOCALES.filter((l) => !featured.includes(l.code) && !value.includes(l.code));

  const toggle = (code: string, on: boolean) =>
    onChange(on ? [...value, code] : value.filter((c) => c !== code));

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((code) => (
            <span
              key={code}
              className="bg-muted inline-flex items-center gap-1.5 rounded-full py-0.5 pe-1 ps-2 text-sm"
            >
              <Flag locale={code} />
              <span lang={code}>{localeInfo(code).native}</span>
              <button
                type="button"
                onClick={() => toggle(code, false)}
                className="hover:bg-muted-foreground/20 rounded-full p-0.5"
                aria-label={`${t("remove")} ${localeInfo(code).native}`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            {t("addLanguage")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-72 w-64 overflow-y-auto">
          {first.length > 0 && (
            <>
              {first.map((l) => (
                <DropdownMenuCheckboxItem
                  key={l.code}
                  checked={false}
                  onCheckedChange={() => toggle(l.code, true)}
                  className="gap-2"
                >
                  <Flag locale={l.code} />
                  <span lang={l.code}>{l.native}</span>
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
                {t("allLanguages")}
              </DropdownMenuLabel>
            </>
          )}
          {rest.map((l) => (
            <DropdownMenuCheckboxItem
              key={l.code}
              checked={false}
              onCheckedChange={() => toggle(l.code, true)}
              className="gap-2"
            >
              <Flag locale={l.code} />
              <span lang={l.code}>{l.native}</span>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
