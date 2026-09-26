"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { Bell, CalendarClock, Hotel, ListChecks, MailCheck, Wallet, type LucideIcon } from "lucide-react";
import { markNotificationsRead } from "@/app/app/rsvp/actions";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

const ICONS: Record<string, LucideIcon> = { rsvp: MailCheck, payment: Wallet, hotel: Hotel, task: ListChecks };

/** Bell with unread count: new RSVPs, to-dos given to you, and daily reminders (payments, hotels, overdue to-dos). */
export function NotificationBell({
  items,
  unread,
  align = "end",
}: {
  items: NotificationItem[];
  unread: number;
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const markRead = (ids?: string[]) => startTransition(() => void markNotificationsRead(ids));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        >
          <Bell aria-hidden />
          {unread > 0 && (
            <span className="bg-primary text-primary-foreground absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full px-1 text-[0.65rem] leading-4 font-medium">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="font-serif text-xl font-semibold">Notifications</p>
          {unread > 0 && (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              disabled={pending}
              onClick={() => markRead()}
            >
              Mark all read
            </Button>
          )}
        </div>
        {items.length === 0 ? (
          <p className="text-muted-foreground px-4 py-8 text-center text-sm">
            Nothing yet. New RSVPs, to-dos for you and reminders about payments and deadlines show up here.
          </p>
        ) : (
          <ul className="max-h-96 divide-y overflow-y-auto">
            {items.map((n) => {
              const Icon = ICONS[n.type] ?? CalendarClock;
              const content = (
                <>
                  <span className="flex items-start gap-2">
                    <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
                    <span className={cn("flex-1 text-sm", !n.readAt && "font-medium")}>{n.title}</span>
                    {!n.readAt && (
                      <span
                        className="bg-primary mt-1.5 size-2 shrink-0 rounded-full"
                        aria-label="Unread"
                      />
                    )}
                  </span>
                  {n.body && <span className="text-muted-foreground block pl-6 text-xs">{n.body}</span>}
                  <span className="text-muted-foreground block pl-6 text-xs">
                    {formatDistanceToNowStrict(parseISO(n.createdAt), { addSuffix: true })}
                  </span>
                </>
              );
              return (
                <li key={n.id}>
                  {n.link ? (
                    <Link
                      href={n.link}
                      className="hover:bg-accent block space-y-0.5 px-4 py-3"
                      onClick={() => {
                        setOpen(false);
                        if (!n.readAt) markRead([n.id]);
                      }}
                    >
                      {content}
                    </Link>
                  ) : (
                    <div className="space-y-0.5 px-4 py-3">{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
