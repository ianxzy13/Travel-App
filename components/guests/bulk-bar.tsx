"use client";

import { useTransition } from "react";
import {
  CalendarCheck,
  ChevronDown,
  Languages,
  Loader2,
  Mail,
  MoreHorizontal,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  bulkSetEvent,
  bulkSetHouseholdLanguage,
  bulkSetTag,
  bulkUpdateGuests,
  deleteGuests,
} from "@/app/app/guests/actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Flag } from "@/components/flag";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LOCALES, localeInfo } from "@/i18n/locales";
import type { ActionResult } from "@/lib/action-result";
import type { PartnerNames } from "@/lib/guests/model";
import { TagBadge } from "./badges";
import type { EventOption, TagOption } from "./types";

/** Floating bar with actions for the selected guests. */
export function BulkBar({
  ids,
  onClear,
  onEmail,
  events,
  tags,
  names,
  coupleLanguage,
  languages,
}: {
  ids: string[];
  onClear: () => void;
  onEmail: () => void;
  events: EventOption[];
  tags: TagOption[];
  names: PartnerNames;
  coupleLanguage: string;
  /** languages households already use (listed first) */
  languages: string[];
}) {
  const t = useTranslations("guests.bulk");
  const g = useTranslations("guests");
  const [pending, startTransition] = useTransition();
  const who = t("who", { count: ids.length });
  const others = languages.filter((l) => l !== coupleLanguage);
  const rest = LOCALES.filter((l) => l.code !== coupleLanguage && !others.includes(l.code));

  function run(action: () => Promise<ActionResult>, message: string) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(message);
      else toast.error(result.error);
    });
  }

  const setLanguage = (code: string) =>
    run(
      () => bulkSetHouseholdLanguage(ids, code),
      t("languageSet", { language: localeInfo(code || coupleLanguage).native }),
    );
  const languageItem = (code: string) => (
    <DropdownMenuItem key={code} onSelect={() => setLanguage(code)} lang={code}>
      <Flag locale={code} /> {localeInfo(code).native}
    </DropdownMenuItem>
  );

  return (
    <div
      role="region"
      aria-label={t("region")}
      className="bg-card fixed inset-x-3 bottom-20 z-40 mx-auto flex max-w-3xl flex-wrap items-center gap-1 rounded-2xl border p-2 shadow-xl md:bottom-6"
    >
      <span className="px-2 text-sm font-medium" aria-live="polite">
        {pending ? (
          <Loader2 className="inline size-4 animate-spin" aria-label={t("saving")} />
        ) : null}{" "}
        {t("selected", { count: ids.length })}
      </span>

      <div className="ms-auto flex flex-wrap items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" disabled={pending || tags.length === 0}>
              <Tag aria-hidden /> {t("tag")} <ChevronDown className="opacity-50" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t("addTag")}</DropdownMenuLabel>
            {tags.map((tag) => (
              <DropdownMenuItem
                key={tag.id}
                onSelect={() =>
                  run(() => bulkSetTag(ids, tag.id, true), t("tagged", { who, tag: tag.name }))
                }
              >
                <TagBadge name={tag.name} color={tag.color} />
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>{t("removeTag")}</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {tags.map((tag) => (
                  <DropdownMenuItem
                    key={tag.id}
                    onSelect={() =>
                      run(
                        () => bulkSetTag(ids, tag.id, false),
                        t("untagged", { who, tag: tag.name }),
                      )
                    }
                  >
                    {tag.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" disabled={pending || events.length === 0}>
              <CalendarCheck aria-hidden /> {t("events")}{" "}
              <ChevronDown className="opacity-50" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t("inviteTo")}</DropdownMenuLabel>
            {events.map((e) => (
              <DropdownMenuItem
                key={e.id}
                onSelect={() =>
                  run(() => bulkSetEvent(ids, e.id, true), t("invited", { who, event: e.name }))
                }
              >
                {e.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>{t("removeFrom")}</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {events.map((e) => (
                  <DropdownMenuItem
                    key={e.id}
                    onSelect={() =>
                      run(
                        () => bulkSetEvent(ids, e.id, false),
                        t("uninvited", { who, event: e.name }),
                      )
                    }
                  >
                    {e.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" disabled={pending}>
              <Languages aria-hidden /> {t("language")}{" "}
              <ChevronDown className="opacity-50" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-80 w-64 overflow-y-auto">
            <DropdownMenuItem onSelect={() => setLanguage("")}>
              <Flag locale={coupleLanguage} />{" "}
              {t("languageDefault", { language: localeInfo(coupleLanguage).native })}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {others.map(languageItem)}
            {others.length > 0 && <DropdownMenuSeparator />}
            {rest.map((l) => languageItem(l.code))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" disabled={pending} aria-label={t("more")}>
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t("moveTo")}</DropdownMenuLabel>
            <DropdownMenuItem
              onSelect={() => run(() => bulkUpdateGuests(ids, { list: "a" }), t("movedA", { who }))}
            >
              {g("toolbar.aList")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => run(() => bulkUpdateGuests(ids, { list: "b" }), t("movedB", { who }))}
            >
              {g("toolbar.bList")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{t("setSide")}</DropdownMenuLabel>
            <DropdownMenuItem
              onSelect={() =>
                run(() => bulkUpdateGuests(ids, { side: "partner_a" }), t("sideUpdated"))
              }
            >
              {g("sideOf", { name: names.a })}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                run(() => bulkUpdateGuests(ids, { side: "partner_b" }), t("sideUpdated"))
              }
            >
              {g("sideOf", { name: names.b })}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => run(() => bulkUpdateGuests(ids, { side: "both" }), t("sideUpdated"))}
            >
              {g("both")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onEmail}
              disabled={pending}
              aria-label={t("email")}
            >
              <Mail aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("emailTip")}</TooltipContent>
        </Tooltip>

        <ConfirmDialog
          trigger={
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              className="text-destructive"
              aria-label={t("delete", { who })}
            >
              <Trash2 aria-hidden />
            </Button>
          }
          title={t("deleteTitle", { who })}
          description={t("deleteText")}
          onConfirm={async () => {
            const result = await deleteGuests(ids);
            if (!result.ok) {
              toast.error(result.error);
              return false;
            }
            toast.success(t("deleted", { who }));
            onClear();
          }}
        />

        <Button variant="ghost" size="sm" onClick={onClear} aria-label={t("clear")}>
          <X aria-hidden />
        </Button>
      </div>
    </div>
  );
}
