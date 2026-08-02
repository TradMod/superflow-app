import type { Tables } from "@/integrations/supabase/types";

export type Task = Tables<"tasks">;
export type Occurrence = Tables<"task_occurrences">;
export type Category = Tables<"categories">;
export type Reminder = Tables<"reminders">;

export const REPEAT_KINDS = ["none", "daily", "weekdays", "weekly", "monthly"] as const;
export type RepeatKind = (typeof REPEAT_KINDS)[number];

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const PRIORITY_LABELS: Record<number, string> = {
  1: "Low",
  2: "Normal",
  3: "High",
};

/** Local (not UTC) yyyy-mm-dd for a Date. */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

export function addDays(key: string, days: number): string {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function formatTime(time: string | null): string | null {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  const hour = h ?? 0;
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${`${m ?? 0}`.padStart(2, "0")} ${suffix}`;
}

/** Does a task have an occurrence on this date? */
export function taskOccursOn(task: Task, dateKey: string): boolean {
  if (task.archived) return false;
  if (dateKey < task.start_date) return false;
  if (task.end_date && dateKey > task.end_date) return false;

  const date = fromDateKey(dateKey);
  const dow = date.getDay();

  switch (task.repeat_kind as RepeatKind) {
    case "none":
      return dateKey === task.start_date;
    case "daily":
      return true;
    case "weekdays":
      return dow >= 1 && dow <= 5;
    case "weekly":
      return (task.repeat_days ?? []).includes(dow);
    case "monthly":
      return date.getDate() === (task.repeat_day_of_month ?? fromDateKey(task.start_date).getDate());
    default:
      return false;
  }
}

export type DayItem = {
  task: Task;
  occurrence: Occurrence | null;
  status: "pending" | "done" | "skipped";
};

export function buildDay(tasks: Task[], occurrences: Occurrence[], dateKey: string): DayItem[] {
  const byTask = new Map(
    occurrences.filter((o) => o.occurrence_date === dateKey).map((o) => [o.task_id, o]),
  );
  return tasks
    .filter((t) => taskOccursOn(t, dateKey))
    .map((task) => {
      const occurrence = byTask.get(task.id) ?? null;
      return {
        task,
        occurrence,
        status: (occurrence?.status ?? "pending") as DayItem["status"],
      };
    })
    .sort((a, b) => {
      const at = a.task.start_time ?? "99:99";
      const bt = b.task.start_time ?? "99:99";
      if (at !== bt) return at < bt ? -1 : 1;
      return b.task.priority - a.task.priority;
    });
}

export type DayStats = {
  dateKey: string;
  planned: number;
  done: number;
  skipped: number;
  completionRate: number;
  minutes: number;
  avgEffort: number | null;
  byCategory: { name: string; minutes: number; done: number }[];
  missed: string[];
  completed: string[];
};

export function computeDayStats(
  items: DayItem[],
  categories: Category[],
  dateKey: string,
): DayStats {
  const planned = items.length;
  const done = items.filter((i) => i.status === "done").length;
  const skipped = items.filter((i) => i.status === "skipped").length;
  const minutes = items.reduce((sum, i) => sum + (i.occurrence?.minutes_spent ?? 0), 0);
  const efforts = items
    .map((i) => i.occurrence?.effort)
    .filter((e): e is number => typeof e === "number");
  const catName = (id: string | null) =>
    categories.find((c) => c.id === id)?.name ?? "Uncategorised";

  const catMap = new Map<string, { name: string; minutes: number; done: number }>();
  for (const item of items) {
    if (item.status !== "done") continue;
    const name = catName(item.task.category_id);
    const entry = catMap.get(name) ?? { name, minutes: 0, done: 0 };
    entry.minutes += item.occurrence?.minutes_spent ?? 0;
    entry.done += 1;
    catMap.set(name, entry);
  }

  return {
    dateKey,
    planned,
    done,
    skipped,
    completionRate: planned === 0 ? 0 : Math.round((done / planned) * 100),
    minutes,
    avgEffort: efforts.length
      ? Math.round((efforts.reduce((a, b) => a + b, 0) / efforts.length) * 10) / 10
      : null,
    byCategory: [...catMap.values()].sort((a, b) => b.minutes - a.minutes),
    missed: items.filter((i) => i.status !== "done").map((i) => i.task.title),
    completed: items.filter((i) => i.status === "done").map((i) => i.task.title),
  };
}

/** Consecutive days up to and including `dateKey` where the habit was completed. */
export function computeStreak(task: Task, occurrences: Occurrence[], dateKey: string): number {
  const doneDates = new Set(
    occurrences
      .filter((o) => o.task_id === task.id && o.status === "done")
      .map((o) => o.occurrence_date),
  );
  let streak = 0;
  let cursor = dateKey;
  for (let i = 0; i < 400; i++) {
    if (!taskOccursOn(task, cursor)) {
      cursor = addDays(cursor, -1);
      if (cursor < task.start_date) break;
      continue;
    }
    if (doneDates.has(cursor)) {
      streak += 1;
      cursor = addDays(cursor, -1);
      continue;
    }
    // today not done yet shouldn't break an otherwise live streak
    if (cursor === dateKey) {
      cursor = addDays(cursor, -1);
      continue;
    }
    break;
  }
  return streak;
}
