"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format } from "date-fns";
import {
  ArrowUpRight,
  CalendarClock,
  GripVertical,
  ListChecks,
  Loader2,
  Plus,
  Sparkles,
  StickyNote,
  Wand2,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { addSuggestedTasks, moveTask, setTaskDone } from "@/app/app/tasks/actions";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TaskRow } from "@/lib/database.types";
import { fmtDate } from "@/lib/i18n/format";
import { orderBetween } from "@/lib/inspiration/layout";
import { PHASES, dueState, phaseOf, type DueState } from "@/lib/tasks/timeline";
import { cn } from "@/lib/utils";
import { TaskSheet } from "./task-sheet";

type Member = { id: string; name: string; role: string };
type Show = "open" | "overdue" | "all" | "done";

type Props = {
  tasks: TaskRow[];
  members: Member[];
  userId: string;
  weddingDate: string | null;
  canEdit: boolean;
  /** suggestion key → why it looks done */
  looksDone: Record<string, string>;
  missingSuggestions: number;
  openTaskId: string | null;
  initialShow: "open" | "overdue";
};

const todayIso = () => format(new Date(), "yyyy-MM-dd");

export function TasksPage(props: Props) {
  const { canEdit, members, userId, weddingDate, looksDone } = props;
  const t = useTranslations("tasks");
  const locale = useLocale();
  const [tasks, setTasks] = useState(props.tasks);
  useEffect(() => setTasks(props.tasks), [props.tasks]);

  const [show, setShow] = useState<Show>(props.initialShow);
  const [who, setWho] = useState("everyone");
  const [sheet, setSheet] = useState<string | "new" | null>(props.openTaskId);
  const [adding, startAdding] = useTransition();
  const [today] = useState(todayIso);

  const names = useMemo(() => new Map(members.map((m) => [m.id, m.name])), [members]);
  const categories = useMemo(
    () => [...new Set(tasks.map((t) => t.category).filter((c): c is string => !!c))].sort(),
    [tasks],
  );

  const visible = tasks.filter((t) => {
    const state = dueState(t.due_date, today, t.done);
    const showOk =
      show === "all" ||
      (show === "done" ? t.done : show === "overdue" ? state === "overdue" : !t.done);
    const whoOk =
      who === "everyone" ||
      (who === "me"
        ? t.assignee_id === userId
        : who === "nobody"
          ? !t.assignee_id
          : t.assignee_id === who);
    return showOk && whoOk;
  });

  // Overdue first, then the timeline phases.
  const groups = useMemo(() => {
    const out: { key: string; label: string; items: TaskRow[] }[] = [];
    const overdue = visible.filter((t) => dueState(t.due_date, today, t.done) === "overdue");
    if (overdue.length) out.push({ key: "overdue", label: t("overdue"), items: overdue });
    for (const p of PHASES) {
      const items = visible.filter(
        (task) =>
          dueState(task.due_date, today, task.done) !== "overdue" &&
          phaseOf(task.due_date, weddingDate) === p,
      );
      if (items.length)
        out.push({
          key: p,
          label: weddingDate || p === "none" ? t(`phases.${p}`) : t("withDue"),
          items,
        });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, today, weddingDate]);

  const total = tasks.length;
  const doneCount = tasks.filter((t) => t.done).length;
  const overdueCount = tasks.filter(
    (t) => dueState(t.due_date, today, t.done) === "overdue",
  ).length;
  const weekCount = tasks.filter((t) =>
    ["today", "soon"].includes(dueState(t.due_date, today, t.done) ?? ""),
  ).length;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Put things back as the server has them, if a save fails (e.g. no connection).
  const undo = () => {
    toast.error(t("offline"));
    setTasks(props.tasks);
  };

  function toggle(task: TaskRow, done: boolean) {
    setTasks((all) => all.map((t) => (t.id === task.id ? { ...t, done } : t)));
    void setTaskDone(task.id, done)
      .then((r) => {
        if (!r.ok) {
          toast.error(r.error);
          setTasks(props.tasks);
        } else if (done) toast.success(t("done"), { description: task.title });
      })
      .catch(undo);
  }

  function onDragEnd(group: TaskRow[], { active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const moving = group.find((t) => t.id === active.id);
    const to = group.findIndex((t) => t.id === over.id);
    if (!moving || to < 0) return;
    const rest = group.filter((t) => t.id !== moving.id);
    // either way the task lands between rest[to - 1] and rest[to]
    const [before, after] = [rest[to - 1], rest[to]];
    const order = orderBetween(before?.sort_order ?? null, after?.sort_order ?? null);
    setTasks((all) =>
      all
        .map((t) => (t.id === moving.id ? { ...t, sort_order: order } : t))
        .sort((a, b) => a.sort_order - b.sort_order),
    );
    void moveTask(moving.id, order)
      .then((r) => !r.ok && (toast.error(r.error), setTasks(props.tasks)))
      .catch(undo);
  }

  function addSuggestions() {
    startAdding(async () => {
      const r = await addSuggestedTasks();
      if (!r.ok) return void toast.error(r.error);
      toast.success(t("added", { count: r.data?.added ?? 0 }));
    });
  }

  const current = sheet && sheet !== "new" ? (tasks.find((t) => t.id === sheet) ?? null) : null;

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          canEdit && (
            <>
              {props.missingSuggestions > 0 && total > 0 && (
                <Button variant="outline" size="sm" onClick={addSuggestions} disabled={adding}>
                  {adding ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : (
                    <Wand2 aria-hidden />
                  )}{" "}
                  {t("addMissing")}
                </Button>
              )}
              <Button size="sm" onClick={() => setSheet("new")}>
                <Plus aria-hidden /> {t("add")}
              </Button>
            </>
          )
        }
      />

      {total === 0 ? (
        <div className="rounded-2xl border border-dashed p-8 text-center sm:p-12">
          <ListChecks className="text-primary-ink mx-auto size-10" aria-hidden />
          <h2 className="mt-4 text-2xl">{t("emptyTitle")}</h2>
          <p className="text-muted-foreground mx-auto mt-2 max-w-md">
            {weddingDate
              ? t("emptyWithDate", { date: fmtDate(weddingDate, locale, "long") })
              : t("emptyNoDate")}
          </p>
          {canEdit && (
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {weddingDate ? (
                <Button onClick={addSuggestions} disabled={adding}>
                  {adding ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : (
                    <Sparkles aria-hidden />
                  )}{" "}
                  {t("create")}
                </Button>
              ) : (
                <Button asChild>
                  <Link href="/app/settings">{t("setDate")}</Link>
                </Button>
              )}
              <Button variant="outline" onClick={() => setSheet("new")}>
                <Plus aria-hidden /> {t("addOwn")}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <>
          <section aria-label={t("progress")} className="mb-6 grid gap-3 sm:grid-cols-3">
            <div className="bg-card rounded-xl border p-4 sm:col-span-1">
              <p className="text-sm">
                <span className="font-serif text-3xl font-medium tabular-nums">{doneCount}</span>{" "}
                <span className="text-muted-foreground">{t("ofDone", { total })}</span>
              </p>
              <div
                className="bg-muted mt-2 h-2 rounded-full"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={doneCount}
                aria-label={t("doneLabel")}
              >
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${(doneCount / total) * 100}%` }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShow("overdue")}
              className={cn(
                "bg-card hover:bg-accent rounded-xl border p-4 text-start",
                overdueCount > 0 && "border-destructive/40",
              )}
            >
              <span
                className={cn(
                  "font-serif text-3xl font-medium tabular-nums",
                  overdueCount > 0 && "text-destructive",
                )}
              >
                {overdueCount}
              </span>{" "}
              <span className="text-muted-foreground text-sm">{t("overdueCount")}</span>
            </button>
            <div className="bg-card rounded-xl border p-4">
              <span className="font-serif text-3xl font-medium tabular-nums">{weekCount}</span>{" "}
              <span className="text-muted-foreground text-sm">{t("thisWeek")}</span>
            </div>
          </section>

          <div className="mb-5 flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border p-0.5" role="group" aria-label={t("show")}>
              {(["open", "overdue", "done", "all"] as const).map((key) => (
                <Button
                  key={key}
                  size="sm"
                  variant={show === key ? "secondary" : "ghost"}
                  aria-pressed={show === key}
                  onClick={() => setShow(key)}
                >
                  {t(`filters.${key}`)}
                </Button>
              ))}
            </div>
            <Select value={who} onValueChange={setWho}>
              <SelectTrigger size="sm" className="w-44" aria-label={t("whose")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="everyone">{t("everyone")}</SelectItem>
                <SelectItem value="me">{t("mine")}</SelectItem>
                <SelectItem value="nobody">{t("nobody")}</SelectItem>
                {members
                  .filter((m) => m.id !== userId)
                  .map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {groups.length === 0 ? (
            <p className="text-muted-foreground rounded-2xl border border-dashed p-10 text-center">
              {show === "overdue"
                ? t("nothingOverdue")
                : show === "done"
                  ? t("nothingDone")
                  : t("nothingHere")}
            </p>
          ) : (
            <div className="space-y-8">
              {groups.map((g) => (
                <section key={g.key} aria-labelledby={`group-${g.key}`}>
                  <h2
                    id={`group-${g.key}`}
                    className={cn(
                      "mb-3 flex items-baseline gap-2 text-2xl",
                      g.key === "overdue" && "text-destructive",
                    )}
                  >
                    {g.label}{" "}
                    <span className="text-muted-foreground font-sans text-sm font-normal">
                      {g.items.length}
                    </span>
                  </h2>
                  <DndContext
                    id={`tasks-${g.key}`}
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={(e) => onDragEnd(g.items, e)}
                  >
                    <SortableContext
                      items={g.items.map((task) => task.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <ul className="bg-card divide-y rounded-xl border">
                        {g.items.map((task) => (
                          <TaskItem
                            key={task.id}
                            task={task}
                            today={today}
                            locale={locale}
                            canEdit={canEdit}
                            sortable={canEdit && g.items.length > 1}
                            assignee={
                              task.assignee_id ? (names.get(task.assignee_id) ?? null) : null
                            }
                            isMine={task.assignee_id === userId}
                            looksDone={
                              task.suggestion_key ? looksDone[task.suggestion_key] : undefined
                            }
                            onToggle={(d) => toggle(task, d)}
                            onOpen={() => setSheet(task.id)}
                          />
                        ))}
                      </ul>
                    </SortableContext>
                  </DndContext>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      <TaskSheet
        open={!!sheet && (sheet === "new" || !!current)}
        task={current}
        members={members}
        categories={categories}
        canEdit={canEdit}
        onOpenChange={(o) => !o && setSheet(null)}
      />
    </>
  );
}

const DUE_STYLE: Record<NonNullable<DueState>, string> = {
  overdue: "text-destructive font-medium",
  today: "text-warning font-medium",
  soon: "text-warning",
  later: "text-muted-foreground",
};

function TaskItem({
  task,
  today,
  locale,
  canEdit,
  sortable,
  assignee,
  isMine,
  looksDone,
  onToggle,
  onOpen,
}: {
  task: TaskRow;
  today: string;
  locale: string;
  canEdit: boolean;
  sortable: boolean;
  assignee: string | null;
  isMine: boolean;
  looksDone?: string;
  onToggle: (done: boolean) => void;
  onOpen: () => void;
}) {
  const t = useTranslations("tasks");
  const s = useSortable({ id: task.id, disabled: !sortable });
  const state = dueState(task.due_date, today, task.done);
  const due = task.due_date ? fmtDate(task.due_date, locale, "medium") : null;

  return (
    <li
      ref={s.setNodeRef}
      style={{ transform: CSS.Translate.toString(s.transform), transition: s.transition }}
      className={cn(
        "flex items-start gap-2 px-2 py-2.5 sm:px-3",
        s.isDragging && "bg-card relative z-10 rounded-xl shadow-lg",
      )}
    >
      {sortable ? (
        <button
          type="button"
          ref={s.setActivatorNodeRef}
          {...s.attributes}
          {...s.listeners}
          aria-label={t("reorder", { title: task.title })}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -ms-1 flex h-6 w-5 shrink-0 cursor-grab touch-none items-center justify-center rounded focus-visible:ring-2 focus-visible:outline-none"
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
      ) : (
        <span className="w-4 shrink-0" />
      )}
      <Checkbox
        checked={task.done}
        disabled={!canEdit}
        onCheckedChange={(v) => onToggle(v === true)}
        aria-label={
          task.done ? t("markUndone", { title: task.title }) : t("markDone", { title: task.title })
        }
        className="mt-0.5 size-5"
      />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onOpen}
          className={cn(
            "focus-visible:ring-ring rounded text-start leading-snug hover:underline focus-visible:ring-2 focus-visible:outline-none",
            task.done && "text-muted-foreground line-through",
          )}
        >
          {task.title}
        </button>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {due && (
            <span
              className={cn(
                "inline-flex items-center gap-1",
                state ? DUE_STYLE[state] : "text-muted-foreground",
              )}
            >
              <CalendarClock className="size-3.5" aria-hidden />
              {state === "overdue"
                ? t("overdueOn", { date: due })
                : state === "today"
                  ? t("dueToday")
                  : due}
            </span>
          )}
          {task.category && <span className="text-muted-foreground">{task.category}</span>}
          {assignee && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5",
                isMine ? "bg-primary-soft text-foreground" : "bg-muted",
              )}
            >
              {isMine ? t("you") : assignee}
            </span>
          )}
          {task.notes && (
            <StickyNote className="text-muted-foreground size-3.5" aria-label={t("hasNotes")} />
          )}
          {task.link && (
            <Link
              href={task.link}
              className="text-primary-ink inline-flex items-center gap-0.5 underline-offset-2 hover:underline"
            >
              {t("open")} <ArrowUpRight className="size-3 rtl:-scale-x-100" aria-hidden />
              <span className="sr-only">{t("pageFor", { title: task.title })}</span>
            </Link>
          )}
        </div>
        {looksDone && !task.done && canEdit && (
          <p className="text-success mt-1 flex flex-wrap items-center gap-2 text-xs">
            <Sparkles className="size-3.5" aria-hidden /> {t("looksDone", { reason: looksDone })}
            <button
              type="button"
              onClick={() => onToggle(true)}
              className="font-medium underline underline-offset-2"
            >
              {t("tickOff")}
            </button>
          </p>
        )}
      </div>
    </li>
  );
}
