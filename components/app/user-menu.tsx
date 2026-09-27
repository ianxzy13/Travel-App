"use client";

import { useTransition } from "react";
import { useTheme } from "next-themes";
import { Check, Languages, LogOut, Monitor, Moon, Sun } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { setAppLanguage } from "@/app/app/settings/language-actions";
import { Flag } from "@/components/flag";
import { LOCALES, localeInfo } from "@/i18n/locales";
import { signOut } from "@/app/login/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type CurrentUser = { name: string | null; email: string; avatarUrl: string | null };

export function initials(nameOrEmail: string) {
  const parts = nameOrEmail.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** Avatar button with theme switcher and sign out. */
export function UserMenu({ user, showName = true }: { user: CurrentUser; showName?: boolean }) {
  const { theme, setTheme } = useTheme();
  const t = useTranslations("app.userMenu");
  const locale = useLocale();
  const [, startTransition] = useTransition();
  const display = user.name ?? user.email;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "hover:bg-accent focus-visible:ring-ring flex min-w-0 items-center gap-2 rounded-lg p-1.5 text-start text-sm transition-colors focus-visible:ring-[3px] focus-visible:outline-none",
          showName && "w-full px-3 py-2",
        )}
        aria-label={t("account")}
      >
        <Avatar className="size-8">
          {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
          <AvatarFallback className="bg-muted text-xs">{initials(display)}</AvatarFallback>
        </Avatar>
        {showName && <span className="min-w-0 flex-1 truncate">{display}</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate font-medium">{display}</span>
          {user.name && (
            <span className="text-muted-foreground block truncate text-xs">{user.email}</span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-muted-foreground text-xs">
          {t("appearance")}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">
            <Sun aria-hidden /> {t("light")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon aria-hidden /> {t("dark")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor aria-hidden /> {t("system")}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Languages aria-hidden /> {t("language")}
            <span className="text-muted-foreground ms-auto inline-flex items-center gap-1.5 text-xs">
              <Flag locale={locale} />
              {localeInfo(locale).native}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-80 w-60 overflow-y-auto">
            {LOCALES.map((l) => (
              <DropdownMenuItem
                key={l.code}
                lang={l.code}
                onSelect={() => startTransition(() => void setAppLanguage(l.code))}
              >
                <Flag locale={l.code} />
                <span className="flex-1">{l.native}</span>
                {l.code === locale && <Check aria-hidden />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => startTransition(() => signOut())}>
          <LogOut aria-hidden /> {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
