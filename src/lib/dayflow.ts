import type { Tables } from "@/integrations/supabase/types";

export type Task = Tables<"tasks">;
export type Occurrence = Tables<"task_occurrences">;
export type Category = Tables<"categories">;
export type Subtask = Tables<"task_subtasks">;
export type SubtaskLog = Tables<"task_subtask_logs">;

/** Subtasks shown under a task on a given day: repeating ones + that day's one-offs. */
export function subtasksForDay(
  subtasks: Subtask[],
  taskId: string,
  dateKey: string,
): Subtask[] {
  return subtasks
    .filter(
      (s) =>
        !s.archived &&
        s.task_id === taskId &&
        (s.recurring ? true : s.for_date === dateKey),
    )
    .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
}

export function isSubtaskDone(
  logs: SubtaskLog[],
  subtaskId: string,
  dateKey: string,
): boolean {
  return logs.some((l) => l.subtask_id === subtaskId && l.log_date === dateKey && l.done);
}




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

export type Override = Tables<"schedule_overrides">;
export type OverrideWithTasks = Override & { task_ids: string[] };

/** Overrides (events) covering a given date. */
export function overridesOn(overrides: OverrideWithTasks[], dateKey: string): OverrideWithTasks[] {
  return overrides.filter((o) => dateKey >= o.start_date && dateKey <= o.end_date);
}

/**
 * Is this task excused on this date by an event?
 * Full-day events excuse whatever they cover; time-window events only excuse
 * tasks scheduled to start inside the window.
 */
export function isExcused(task: Task, dateKey: string, overrides: OverrideWithTasks[]): boolean {
  for (const o of overridesOn(overrides, dateKey)) {
    if (!o.excuse_all && !o.task_ids.includes(task.id)) continue;
    if (o.start_time && o.end_time) {
      const t = task.start_time?.slice(0, 5);
      if (!t) continue;
      if (t < o.start_time.slice(0, 5) || t >= o.end_time.slice(0, 5)) continue;
    }
    return true;
  }
  return false;
}

export type DayItem = {
  task: Task;
  occurrence: Occurrence | null;
  status: "pending" | "done" | "skipped";
};

export function buildDay(
  tasks: Task[],
  occurrences: Occurrence[],
  dateKey: string,
  overrides: OverrideWithTasks[] = [],
): DayItem[] {
  const byTask = new Map(
    occurrences.filter((o) => o.occurrence_date === dateKey).map((o) => [o.task_id, o]),
  );
  return tasks
    .filter((t) => taskOccursOn(t, dateKey) && !isExcused(t, dateKey, overrides))
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
  notes: { title: string; note: string }[];
  efforts: { title: string; effort: number | null; minutes: number }[];
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

/**
 * Consecutive days up to and including `dateKey` where the habit was completed.
 * Days excused by an event are skipped rather than breaking the streak.
 */
export function computeStreak(
  task: Task,
  occurrences: Occurrence[],
  dateKey: string,
  overrides: OverrideWithTasks[] = [],
): number {
  const doneDates = new Set(
    occurrences
      .filter((o) => o.task_id === task.id && o.status === "done")
      .map((o) => o.occurrence_date),
  );
  let streak = 0;
  let cursor = dateKey;
  for (let i = 0; i < 400; i++) {
    if (!taskOccursOn(task, cursor) || isExcused(task, cursor, overrides)) {
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

/* ---------------- Periods (day / week / month) ---------------- */

export const PERIODS = ["day", "week", "month"] as const;
export type PeriodKind = (typeof PERIODS)[number];

/** Monday-based start of week. */
export function startOfWeek(dateKey: string): string {
  const d = fromDateKey(dateKey);
  const dow = (d.getDay() + 6) % 7;
  return addDays(dateKey, -dow);
}

export function startOfMonth(dateKey: string): string {
  return `${dateKey.slice(0, 7)}-01`;
}

export function endOfMonth(dateKey: string): string {
  const d = fromDateKey(dateKey);
  return toDateKey(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

export function periodRange(period: PeriodKind, anchor: string): { start: string; end: string } {
  if (period === "day") return { start: anchor, end: anchor };
  if (period === "week") {
    const start = startOfWeek(anchor);
    return { start, end: addDays(start, 6) };
  }
  return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
}

export function datesBetween(start: string, end: string): string[] {
  const out: string[] = [];
  let cursor = start;
  while (cursor <= end && out.length < 400) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return out;
}

export function periodLabel(period: PeriodKind, start: string, end: string): string {
  if (period === "day") {
    return fromDateKey(start).toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }
  if (period === "month") {
    return fromDateKey(start).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }
  const fmt = (k: string) =>
    fromDateKey(k).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

export type RangeStats = {
  period: PeriodKind;
  start: string;
  end: string;
  label: string;
  planned: number;
  done: number;
  skipped: number;
  completionRate: number;
  minutes: number;
  avgEffort: number | null;
  excusedDays: number;
  byCategory: { name: string; minutes: number; done: number }[];
  perDay: { dateKey: string; planned: number; done: number; completionRate: number; minutes: number }[];
  habits: { title: string; done: number; scheduled: number; rate: number }[];
  bestDay: string | null;
  worstDay: string | null;
  events: string[];
  completed: string[];
  missed: string[];
};

export function computeRangeStats(input: {
  period: PeriodKind;
  start: string;
  end: string;
  tasks: Task[];
  occurrences: Occurrence[];
  categories: Category[];
  overrides: OverrideWithTasks[];
}): RangeStats {
  const { period, start, end, tasks, occurrences, categories, overrides } = input;
  const dates = datesBetween(start, end);
  const today = todayKey();
  const inPast = dates.filter((d) => d <= today);

  const perDay: RangeStats["perDay"] = [];
  const catMap = new Map<string, { name: string; minutes: number; done: number }>();
  const completed: string[] = [];
  const missed: string[] = [];
  let planned = 0;
  let done = 0;
  let skipped = 0;
  let minutes = 0;
  const efforts: number[] = [];

  for (const dateKey of inPast) {
    const items = buildDay(tasks, occurrences, dateKey, overrides);
    const stats = computeDayStats(items, categories, dateKey);
    perDay.push({
      dateKey,
      planned: stats.planned,
      done: stats.done,
      completionRate: stats.completionRate,
      minutes: stats.minutes,
    });
    planned += stats.planned;
    done += stats.done;
    skipped += stats.skipped;
    minutes += stats.minutes;
    for (const item of items) {
      if (typeof item.occurrence?.effort === "number") efforts.push(item.occurrence.effort);
    }
    for (const c of stats.byCategory) {
      const entry = catMap.get(c.name) ?? { name: c.name, minutes: 0, done: 0 };
      entry.minutes += c.minutes;
      entry.done += c.done;
      catMap.set(c.name, entry);
    }
    completed.push(...stats.completed);
    missed.push(...stats.missed);
  }

  const habits = tasks
    .filter((t) => t.is_habit)
    .map((t) => {
      const scheduledDays = inPast.filter(
        (d) => taskOccursOn(t, d) && !isExcused(t, d, overrides),
      );
      const doneDays = scheduledDays.filter((d) =>
        occurrences.some(
          (o) => o.task_id === t.id && o.occurrence_date === d && o.status === "done",
        ),
      );
      return {
        title: t.title,
        done: doneDays.length,
        scheduled: scheduledDays.length,
        rate: scheduledDays.length === 0 ? 0 : Math.round((doneDays.length / scheduledDays.length) * 100),
      };
    })
    .filter((h) => h.scheduled > 0)
    .sort((a, b) => b.rate - a.rate);

  const rated = perDay.filter((d) => d.planned > 0);
  const best = rated.reduce<RangeStats["perDay"][number] | null>(
    (acc, d) => (!acc || d.completionRate > acc.completionRate ? d : acc),
    null,
  );
  const worst = rated.reduce<RangeStats["perDay"][number] | null>(
    (acc, d) => (!acc || d.completionRate < acc.completionRate ? d : acc),
    null,
  );

  const excusedDays = dates.filter((d) => overridesOn(overrides, d).length > 0).length;
  const events = [
    ...new Set(
      overrides.filter((o) => o.start_date <= end && o.end_date >= start).map((o) => o.title),
    ),
  ];

  const uniq = (list: string[]) => [...new Set(list)];

  return {
    period,
    start,
    end,
    label: periodLabel(period, start, end),
    planned,
    done,
    skipped,
    completionRate: planned === 0 ? 0 : Math.round((done / planned) * 100),
    minutes,
    avgEffort: efforts.length
      ? Math.round((efforts.reduce((a, b) => a + b, 0) / efforts.length) * 10) / 10
      : null,
    excusedDays,
    byCategory: [...catMap.values()].sort((a, b) => b.minutes - a.minutes),
    perDay,
    habits,
    bestDay: best?.dateKey ?? null,
    worstDay: worst?.dateKey ?? null,
    events,
    completed: uniq(completed).slice(0, 60),
    missed: uniq(missed).slice(0, 60),
  };
}

/* ---------------- Goals ---------------- */

export type Goal = Tables<"goals">;
export type GoalMilestone = Tables<"goal_milestones">;
export type GoalDailyLog = Tables<"goal_daily_logs">;

export const GOAL_PERIODS = ["daily", "weekly", "monthly", "yearly"] as const;
export type GoalPeriod = (typeof GOAL_PERIODS)[number];

export const GOAL_TRACKINGS = ["numeric", "checklist", "both"] as const;
export type GoalTracking = (typeof GOAL_TRACKINGS)[number];

export const GOAL_PERIOD_LABEL: Record<GoalPeriod, string> = {
  daily: "Today",
  weekly: "This week",
  monthly: "This month",
  yearly: "This year",
};

/** Daily goals track a value per day; every other period tracks one running value. */
export function goalCurrentValue(
  goal: Goal,
  dailyLogs: GoalDailyLog[] = [],
  dateKey: string = todayKey(),
): number {
  if (goal.period === "daily") {
    const log = dailyLogs.find((l) => l.goal_id === goal.id && l.log_date === dateKey);
    return Number(log?.value ?? 0);
  }
  return Number(goal.current_value);
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function goalNumericProgress(
  goal: Goal,
  dailyLogs: GoalDailyLog[] = [],
  dateKey: string = todayKey(),
): number {
  const target = Number(goal.target_value) || 1;
  return clampPercent((goalCurrentValue(goal, dailyLogs, dateKey) / target) * 100);
}

export function goalChecklistProgress(goal: Goal, milestones: GoalMilestone[]): number {
  const mine = milestones.filter((m) => m.goal_id === goal.id);
  if (mine.length === 0) return 0;
  return clampPercent((mine.filter((m) => m.done).length / mine.length) * 100);
}

/** Goals tracked by both a number and milestones average the two halves. */
export function goalProgress(
  goal: Goal,
  milestones: GoalMilestone[],
  dailyLogs: GoalDailyLog[] = [],
  dateKey: string = todayKey(),
): number {
  const tracking = goal.tracking as GoalTracking;
  if (tracking === "checklist") return goalChecklistProgress(goal, milestones);
  if (tracking === "numeric") return goalNumericProgress(goal, dailyLogs, dateKey);
  return clampPercent(
    (goalNumericProgress(goal, dailyLogs, dateKey) + goalChecklistProgress(goal, milestones)) / 2,
  );
}

/** Streak of consecutive days a daily goal hit its target, ending at `dateKey`. */
export function dailyGoalStreak(
  goal: Goal,
  dailyLogs: GoalDailyLog[],
  dateKey: string = todayKey(),
): number {
  const target = Number(goal.target_value) || 1;
  const hit = new Set(
    dailyLogs
      .filter((l) => l.goal_id === goal.id && (l.done || Number(l.value) >= target))
      .map((l) => l.log_date),
  );
  let streak = 0;
  let cursor = dateKey;
  for (let i = 0; i < 400; i++) {
    if (hit.has(cursor)) {
      streak += 1;
      cursor = addDays(cursor, -1);
      continue;
    }
    if (cursor === dateKey) {
      cursor = addDays(cursor, -1);
      continue;
    }
    break;
  }
  return streak;
}

export function daysLeft(targetDate: string): number {
  const ms = fromDateKey(targetDate).getTime() - fromDateKey(todayKey()).getTime();
  return Math.round(ms / 86400000);
}

export function goalPace(goal: Goal, progress: number): "done" | "on track" | "behind" {
  if (progress >= 100 || goal.status === "achieved") return "done";
  const total = Math.max(
    1,
    Math.round(
      (fromDateKey(goal.target_date).getTime() - fromDateKey(goal.start_date).getTime()) / 86400000,
    ),
  );
  const elapsed = Math.max(
    0,
    Math.round((fromDateKey(todayKey()).getTime() - fromDateKey(goal.start_date).getTime()) / 86400000),
  );
  const expected = Math.min(100, Math.round((elapsed / total) * 100));
  return progress + 5 >= expected ? "on track" : "behind";
}

