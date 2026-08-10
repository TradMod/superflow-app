import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  categoriesQuery,
  occurrencesQuery,
  overridesQuery,
  periodReviewQuery,
  subtaskLogsQuery,
  subtasksQuery,
  tasksQuery,
} from "@/lib/queries";
import { generatePeriodSummary } from "@/lib/review.functions";
import {
  addDays,
  buildDay,
  computeRangeStats,
  computeStreak,
  formatTime,
  fromDateKey,
  isSubtaskDone,
  subtasksForDay,
  periodRange,
  PERIODS,
  todayKey,
  type PeriodKind,
} from "@/lib/dayflow";

export const Route = createFileRoute("/_authenticated/review")({
  head: () => ({
    meta: [
      { title: "Reviews — SuperFlow" },
      { name: "description", content: "Daily, weekly and monthly AI reviews of how your time went." },
      { property: "og:title", content: "Reviews — SuperFlow" },
      {
        property: "og:description",
        content: "Daily, weekly and monthly AI reviews of how your time went.",
      },
    ],
  }),
  component: ReviewPage,
});

const PERIOD_LABEL: Record<PeriodKind, string> = { day: "Day", week: "Week", month: "Month" };

function ReviewPage() {
  const qc = useQueryClient();
  const today = todayKey();
  const tomorrow = addDays(today, 1);
  const [period, setPeriod] = useState<PeriodKind>("day");
  const range = useMemo(() => periodRange(period, today), [period, today]);

  const tasks = useQuery(tasksQuery());
  const occurrences = useQuery(occurrencesQuery(addDays(range.start, -60), range.end));
  const categories = useQuery(categoriesQuery());
  const overrides = useQuery(overridesQuery());
  const subtasks = useQuery(subtasksQuery());
  const subtaskLogs = useQuery(subtaskLogsQuery(range.start, range.end));
  
  const review = useQuery(periodReviewQuery(period, range.start));
  const summarize = useServerFn(generatePeriodSummary);

  const stats = useMemo(
    () =>
      computeRangeStats({
        period,
        start: range.start,
        end: range.end,
        tasks: tasks.data ?? [],
        occurrences: occurrences.data ?? [],
        categories: categories.data ?? [],
        overrides: overrides.data ?? [],
      }),
    [period, range, tasks.data, occurrences.data, categories.data, overrides.data],
  );

  const tomorrowItems = useMemo(
    () => buildDay(tasks.data ?? [], [], tomorrow, overrides.data ?? []),
    [tasks.data, overrides.data, tomorrow],
  );
  const streaks = useMemo(
    () =>
      (tasks.data ?? [])
        .filter((t) => t.is_habit)
        .map((t) => ({
          title: t.title,
          days: computeStreak(t, occurrences.data ?? [], today, overrides.data ?? []),
        }))
        .filter((s) => s.days > 0)
        .sort((a, b) => b.days - a.days),
    [tasks.data, occurrences.data, overrides.data, today],
  );

  const todaySubtasks = useMemo(() => {
    const items = buildDay(tasks.data ?? [], occurrences.data ?? [], today, overrides.data ?? []);
    return items.flatMap((i) =>
      subtasksForDay(subtasks.data ?? [], i.task.id, today).map((s) => ({
        parent: i.task.title,
        title: s.title,
        done: isSubtaskDone(subtaskLogs.data ?? [], s.id, today),
      })),
    );
  }, [tasks.data, occurrences.data, overrides.data, subtasks.data, subtaskLogs.data, today]);

  const generate = useMutation({
    mutationFn: async () =>
      summarize({
        data: {
          ...stats,
          periodStart: range.start,
          tomorrowTasks: tomorrowItems.map((i) => i.task.title).slice(0, 60),
          
          streaks: streaks.slice(0, 30),
          subtasks: todaySubtasks.slice(0, 60),
        },
      }),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["period_review", period, range.start] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const fmtDay = (key: string | null) =>
    key ? fromDateKey(key).toLocaleDateString(undefined, { weekday: "short", day: "numeric" }) : "—";

  return (
    <AppShell title="Reviews" subtitle={stats.label}>
      <div className="mb-5 inline-flex panel sheen p-1">
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
              period === p ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {PERIOD_LABEL[p]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Completed", value: `${stats.done}/${stats.planned}` },
          { label: "Completion", value: `${stats.completionRate}%` },
          { label: "Minutes", value: stats.minutes },
          { label: "Avg effort", value: stats.avgEffort ?? "—" },
        ].map((s) => (
          <div key={s.label} className="panel sheen p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{s.label}</p>
            <p className="font-display text-lg font-semibold font-semibold">{s.value}</p>
          </div>
        ))}
      </div>

      {stats.events.length > 0 && (
        <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary">
            Events in this period
          </p>
          <p>
            {stats.events.join(", ")} · {stats.excusedDays} day
            {stats.excusedDays === 1 ? "" : "s"} excused — streaks are protected.
          </p>
        </div>
      )}

      {period !== "day" && stats.perDay.length > 0 && (
        <div className="mt-4 panel sheen p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Day by day
          </h2>
          <div className="flex items-end gap-1">
            {stats.perDay.map((d) => (
              <div key={d.dateKey} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-primary/70"
                  style={{ height: `${Math.max(3, d.completionRate)}px` }}
                  title={`${d.dateKey}: ${d.completionRate}%`}
                />
                <span className="text-[10px] text-muted-foreground">{d.dateKey.slice(-2)}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Best {fmtDay(stats.bestDay)} · Weakest {fmtDay(stats.worstDay)}
          </p>
        </div>
      )}

      {stats.byCategory.length > 0 && (
        <div className="mt-4 panel sheen p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Where the time went
          </h2>
          <ul className="space-y-2 text-sm">
            {stats.byCategory.map((c) => (
              <li key={c.name} className="flex items-center justify-between">
                <span>{c.name}</span>
                <span className="text-muted-foreground">
                  {c.minutes} min · {c.done} tasks
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 panel sheen p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">AI {PERIOD_LABEL[period].toLowerCase()} review</h2>
          <Button
            variant={review.data?.summary ? "outline" : "default"}
            disabled={generate.isPending || stats.planned === 0}
            onClick={() => generate.mutate()}
          >
            <Sparkles className="mr-1 h-4 w-4" />
            {generate.isPending ? "Thinking…" : review.data?.summary ? "Regenerate" : "Generate review"}
          </Button>
        </div>
        {review.data?.summary ? (
          <p className="whitespace-pre-line text-sm leading-relaxed">{review.data.summary}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {stats.planned === 0
              ? "There's nothing tracked in this period yet."
              : `Generate a review of this ${period} to see patterns and concrete suggestions.`}
          </p>
        )}
      </div>

      {period !== "day" && stats.habits.length > 0 && (
        <div className="mt-4 panel sheen p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Habit consistency
          </h2>
          <ul className="space-y-1 text-sm">
            {stats.habits.map((h) => (
              <li key={h.title} className="flex items-center justify-between">
                <span>{h.title}</span>
                <span className="text-muted-foreground">
                  {h.done}/{h.scheduled} days · {h.rate}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {streaks.length > 0 && (
        <div className="mt-4 panel sheen p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Live streaks
          </h2>
          <ul className="space-y-1 text-sm">
            {streaks.map((s) => (
              <li key={s.title} className="flex items-center justify-between">
                <span>{s.title}</span>
                <span className="text-muted-foreground">{s.days} days</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 panel sheen p-5">
        <h2 className="mb-3 font-display text-lg font-semibold">On the table tomorrow</h2>
        {tomorrowItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing scheduled yet for tomorrow.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {tomorrowItems.map((i) => (
              <li key={i.task.id} className="flex items-center justify-between">
                <span>{i.task.title}</span>
                <span className="text-muted-foreground">
                  {formatTime(i.task.start_time) ?? "anytime"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

    </AppShell>
  );
}
