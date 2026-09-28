"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Bell,
  CalendarClock,
  Hotel,
  ListChecks,
  MailCheck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { markNotificationsRead } from "@/app/app/rsvp/actions";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fmtDate, fmtMoney, relative } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  /** what it's about (kind + values), to write it in the reader's language */
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
};

type NoticeT = ReturnType<typeof useTranslations<"notices">>;

/** Title and body in the reader's language; older notifications keep their stored English text. */
function noticeText(n: NotificationItem, t: NoticeT, locale: string) {
  const d = n.data ?? {};
  const str = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : "");
  const num = (k: string) => (typeof d[k] === "number" ? (d[k] as number) : 0);
  const date = (k: string) => (str(k) ? fmtDate(str(k), locale, "medium") : "");
  switch (d.kind) {
    case "rsvpReplied":
    case "rsvpUpdated": {
      const k = d.kind as "rsvpReplied" | "rsvpUpdated";
      return {
        title: t(`${k}.title`, { name: str("name") }),
        body: t(`${k}.body`, { attending: num("attending"), declined: num("declined") }),
      };
    }
    case "taskAssigned":
      return {
        title: t("taskAssigned.title", { who: str("who") || t("someone") }),
        body: str("due")
          ? t("taskAssigned.bodyDue", { title: str("title"), date: date("due") })
          : t("taskAssigned.body", { title: str("title") }),
      };
    case "paymentSoon":
    case "paymentLate": {
      const k = d.kind as "paymentSoon" | "paymentLate";
      const amount = str("currency") ? fmtMoney(num("amount"), str("currency"), locale, true) : "";
      return {
        title: t(`${k}.title`, { name: str("name") }),
        body: t(`${k}.body`, { amount, date: date("due") }),
      };
    }
    case "hotelCutoff":
      return {
        title: t("hotelCutoff.title", { name: str("name") }),
        body:
          typeof d.held === "number"
            ? t("hotelCutoff.bodyRooms", {
                date: date("due"),
                booked: num("booked"),
                held: num("held"),
              })
            : t("hotelCutoff.body", { date: date("due") }),
      };
    case "taskDueToday":
      return { title: t("taskDueToday.title", { title: str("title") }), body: null };
    case "taskDue":
      return { title: t("taskDue.title", { title: str("title"), date: date("due") }), body: null };
    case "tasksOverdue":
      return {
        title: t("tasksOverdue.title", { count: num("count") }),
        body:
          num("count") > 1
            ? t("tasksOverdue.bodyMore", { title: str("title") })
            : t("tasksOverdue.body", { title: str("title") }),
      };
    default:
      return { title: n.title, body: n.body };
  }
}

const ICONS: Record<string, LucideIcon> = {
  rsvp: MailCheck,
  payment: Wallet,
  hotel: Hotel,
  task: ListChecks,
};

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
  const t = useTranslations("app.notifications");
  const tn = useTranslations("notices");
  const locale = useLocale();
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
          aria-label={unread ? t("unread", { count: unread }) : t("title")}
        >
          <Bell aria-hidden />
          {unread > 0 && (
            <span className="bg-primary text-primary-foreground absolute end-1 top-1 flex min-w-4 items-center justify-center rounded-full px-1 text-[0.65rem] leading-4 font-medium">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="font-serif text-xl font-medium">{t("title")}</p>
          {unread > 0 && (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              disabled={pending}
              onClick={() => markRead()}
            >
              {t("markAll")}
            </Button>
          )}
        </div>
        {items.length === 0 ? (
          <p className="text-muted-foreground px-4 py-8 text-center text-sm">{t("empty")}</p>
        ) : (
          <ul className="max-h-96 divide-y overflow-y-auto">
            {items.map((n) => {
              const Icon = ICONS[n.type] ?? CalendarClock;
              const text = noticeText(n, tn, locale);
              const content = (
                <>
                  <span className="flex items-start gap-2">
                    <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
                    <span className={cn("flex-1 text-sm", !n.readAt && "font-medium")}>
                      {text.title}
                    </span>
                    {!n.readAt && (
                      <span
                        className="bg-primary mt-1.5 size-2 shrink-0 rounded-full"
                        aria-label={t("unreadOne")}
                      />
                    )}
                  </span>
                  {text.body && (
                    <span className="text-muted-foreground block ps-6 text-xs">{text.body}</span>
                  )}
                  <span className="text-muted-foreground block ps-6 text-xs">
                    {relative(n.createdAt, locale)}
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
