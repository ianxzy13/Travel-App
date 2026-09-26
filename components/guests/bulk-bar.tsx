"use client";

import { useTransition } from "react";
import {
  CalendarCheck,
  ChevronDown,
  Loader2,
  Mail,
  MoreHorizontal,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { bulkSetEvent, bulkSetTag, bulkUpdateGuests, deleteGuests } from "@/app/app/guests/actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
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
}: {
  ids: string[];
  onClear: () => void;
  onEmail: () => void;
  events: EventOption[];
  tags: TagOption[];
  names: PartnerNames;
}) {
  const [pending, startTransition] = useTransition();
  const n = ids.length;
  const who = `${n} guest${n === 1 ? "" : "s"}`;

  function run(action: () => Promise<ActionResult>, message: string) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(message);
      else toast.error(result.error);
    });
  }

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="bg-card fixed inset-x-3 bottom-20 z-40 mx-auto flex max-w-3xl flex-wrap items-center gap-1 rounded-2xl border p-2 shadow-xl md:bottom-6"
    >
      <span className="px-2 text-sm font-medium" aria-live="polite">
        {pending ? <Loader2 className="inline size-4 animate-spin" aria-label="Saving" /> : null}{" "}
        {who} selected
      </span>

      <div className="ml-auto flex flex-wrap items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" disabled={pending || tags.length === 0}>
              <Tag aria-hidden /> Tag <ChevronDown className="opacity-50" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Add tag</DropdownMenuLabel>
            {tags.map((t) => (
              <DropdownMenuItem
                key={t.id}
                onSelect={() => run(() => bulkSetTag(ids, t.id, true), `Tagged ${who} “${t.name}”`)}
              >
                <TagBadge name={t.name} color={t.color} />
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Remove tag</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {tags.map((t) => (
                  <DropdownMenuItem
                    key={t.id}
                    onSelect={() =>
                      run(() => bulkSetTag(ids, t.id, false), `Removed “${t.name}” from ${who}`)
                    }
                  >
                    {t.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" disabled={pending || events.length === 0}>
              <CalendarCheck aria-hidden /> Events{" "}
              <ChevronDown className="opacity-50" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Invite to</DropdownMenuLabel>
            {events.map((e) => (
              <DropdownMenuItem
                key={e.id}
                onSelect={() =>
                  run(() => bulkSetEvent(ids, e.id, true), `Invited ${who} to ${e.name}`)
                }
              >
                {e.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Remove from</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {events.map((e) => (
                  <DropdownMenuItem
                    key={e.id}
                    onSelect={() =>
                      run(() => bulkSetEvent(ids, e.id, false), `Removed ${who} from ${e.name}`)
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
            <Button variant="ghost" size="sm" disabled={pending} aria-label="More actions">
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Move to list</DropdownMenuLabel>
            <DropdownMenuItem
              onSelect={() =>
                run(() => bulkUpdateGuests(ids, { list: "a" }), `Moved ${who} to the A-list`)
              }
            >
              A-list
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                run(() => bulkUpdateGuests(ids, { list: "b" }), `Moved ${who} to the B-list`)
              }
            >
              B-list
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Set side</DropdownMenuLabel>
            <DropdownMenuItem
              onSelect={() =>
                run(() => bulkUpdateGuests(ids, { side: "partner_a" }), "Side updated")
              }
            >
              {names.a}&apos;s side
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                run(() => bulkUpdateGuests(ids, { side: "partner_b" }), "Side updated")
              }
            >
              {names.b}&apos;s side
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => run(() => bulkUpdateGuests(ids, { side: "both" }), "Side updated")}
            >
              Both
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
              aria-label="Email their households"
            >
              <Mail aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Email invitation or reminder</TooltipContent>
        </Tooltip>

        <ConfirmDialog
          trigger={
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              className="text-destructive"
              aria-label={`Delete ${who}`}
            >
              <Trash2 aria-hidden />
            </Button>
          }
          title={`Delete ${who}?`}
          description="Their plus-ones, event invitations, tags and seating rules will be deleted too. This can't be undone."
          onConfirm={async () => {
            const result = await deleteGuests(ids);
            if (!result.ok) {
              toast.error(result.error);
              return false;
            }
            toast.success(`Deleted ${who}`);
            onClear();
          }}
        />

        <Button variant="ghost" size="sm" onClick={onClear} aria-label="Clear selection">
          <X aria-hidden />
        </Button>
      </div>
    </div>
  );
}
