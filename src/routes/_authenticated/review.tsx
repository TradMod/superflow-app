import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { categoriesQuery, dayReviewQuery, occurrencesQuery, tasksQuery } from "@/lib/queries";
import { generateDaySummary } from "@/lib/review.functions";
import { addDays, buildDay, computeDayStats, computeStreak, todayKey } from "@/lib/dayflow";

export const Route = createFileRoute("/_authenticated/review")({
  head: () => ({
    meta: [
      { title: "Day review — DayFlow" },
      { name: "description", content: "An honest end-of-day review and a preview of tomorrow." },
      { property: "og:title", content: "Day review — DayFlow" },
      { property: "og:description", content: "An honest end-of-day review and a preview of tomorrow." },
    ],
  }),
  component: ReviewPage,
});

function ReviewPage() {
  const qc = useQueryClient();
  const today = todayKey();
  const tomorrow = addDays(today, 1);

  const tasks = useQuery(tasksQuery());
  const occurrences = useQuery(occurrencesQuery(addDays(today, -60), today));
  const categories = useQuery(categoriesQuery());
  const review = useQuery(dayReviewQuery(today));
  const summarize = useServerFn(generateDaySummary);

  const items = useMemo(
    () => buildDay(tasks.data ?? [], occurrences.data ?? [], today),
    [tasks.data, occurrences.data, today],
  );
  const stats = useMemo(
    () => computeDayStats(items, categories.data ?? [], today),
    [items, categories.data, today],
  );
  const tomorrowItems = useMemo(
    () => buildDay(tasks.data ?? [], [], tomorrow),
    [tasks.data, tomorrow],
  );
  const streaks = useMemo(
    () =>
      (tasks.data ?? [])
        .filter((t) => t.is_habit)
        .map((t) => ({ title: t.title, days: computeStreak(t, occurrences.data ?? [], today) }))
        .filter((s) => s.days > 0)
        .sort((a, b) => b.days - a.days),
    [tasks.data, occurrences.data, today],
  );

  const generate = useMutation({
    mutationFn: async () =>
      summarize({
        data: {
          ...stats,
          completed: stats.completed.slice(0, 60),
          missed: stats.missed.slice(0, 60),
          tomorrow: tomorrowItems.map((i) => i.task.title).slice(0, 60),
          streaks: streaks.slice(0, 30),
        },
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["day_review", today] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell title="Day review" subtitle="How today went, and what's on the table tomorrow">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Completed", value: `${stats.done}/${stats.planned}` },
          { label: "Completion", value: `${stats.completionRate}%` },
          { label: "Minutes", value: stats.minutes },
          { label: "Avg effort", value: stats.avgEffort ?? "—" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{s.label}</p>
            <p className="font-display text-3xl">{s.value}</p>
          </div>
        ))}
      </div>

      {stats.byCategory.length > 0 && (
        <div className="mt-4 rounded-2xl border border-border bg-card p-5">
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

      <div className="mt-4 rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl">AI review</h2>
          <Button
            variant={review.data?.summary ? "outline" : "default"}
            disabled={generate.isPending || stats.planned === 0}
            onClick={() => generate.mutate()}
          >
            <Sparkles className="mr-1 h-4 w-4" />
            {generate.isPending
              ? "Thinking…"
              : review.data?.summary
                ? "Regenerate"
                : "Generate review"}
          </Button>
        </div>
        {review.data?.summary ? (
          <p className="whitespace-pre-line text-sm leading-relaxed">{review.data.summary}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {stats.planned === 0
              ? "Add some tasks to today first — there's nothing to review yet."
              : "Generate a review to see what went well, what slipped, and suggestions for tomorrow."}
          </p>
        )}
      </div>

      {streaks.length > 0 && (
        <div className="mt-4 rounded-2xl border border-border bg-card p-5">
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

      <div className="mt-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-3 font-display text-2xl">On the table tomorrow</h2>
        {tomorrowItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing scheduled yet for tomorrow.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {tomorrowItems.map((i) => (
              <li key={i.task.id} className="flex items-center justify-between">
                <span>{i.task.title}</span>
                <span className="text-muted-foreground">{i.task.start_time?.slice(0, 5) ?? "anytime"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
