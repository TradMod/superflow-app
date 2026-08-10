import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { categoriesQuery, occurrencesQuery, tasksQuery } from "@/lib/queries";
import { addDays, buildDay, computeDayStats, computeStreak, todayKey } from "@/lib/dayflow";

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => ({
    meta: [
      { title: "Insights — SuperFlow" },
      { name: "description", content: "Completion trends, streaks and where your hours go." },
      { property: "og:title", content: "Insights — SuperFlow" },
      { property: "og:description", content: "Completion trends, streaks and where your hours go." },
    ],
  }),
  component: InsightsPage,
});

function InsightsPage() {
  const today = todayKey();
  const from = addDays(today, -13);

  const tasks = useQuery(tasksQuery());
  const occurrences = useQuery(occurrencesQuery(addDays(today, -60), today));
  const categories = useQuery(categoriesQuery());

  const daily = useMemo(() => {
    const rows: { date: string; completion: number; minutes: number }[] = [];
    for (let i = 0; i < 14; i++) {
      const key = addDays(from, i);
      const stats = computeDayStats(
        buildDay(tasks.data ?? [], occurrences.data ?? [], key),
        categories.data ?? [],
        key,
      );
      rows.push({ date: key.slice(5), completion: stats.completionRate, minutes: stats.minutes });
    }
    return rows;
  }, [tasks.data, occurrences.data, categories.data, from]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < 14; i++) {
      const key = addDays(from, i);
      const stats = computeDayStats(
        buildDay(tasks.data ?? [], occurrences.data ?? [], key),
        categories.data ?? [],
        key,
      );
      for (const c of stats.byCategory) map.set(c.name, (map.get(c.name) ?? 0) + c.minutes);
    }
    return [...map.entries()]
      .map(([name, minutes]) => ({ name, minutes }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [tasks.data, occurrences.data, categories.data, from]);

  const streaks = useMemo(
    () =>
      (tasks.data ?? [])
        .filter((t) => t.is_habit)
        .map((t) => ({ title: t.title, days: computeStreak(t, occurrences.data ?? [], today) }))
        .sort((a, b) => b.days - a.days)
        .slice(0, 8),
    [tasks.data, occurrences.data, today],
  );

  return (
    <AppShell title="Insights" subtitle="The last two weeks at a glance">
      <div className="panel sheen p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Completion rate
        </h2>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
              <Tooltip
                contentStyle={{
                  background: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="completion"
                stroke="var(--color-primary)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-4 panel sheen p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Minutes per day
        </h2>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
              <Tooltip
                contentStyle={{
                  background: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="minutes" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="panel sheen p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Time by category
          </h2>
          {byCategory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No time logged yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {byCategory.map((c) => (
                <li key={c.name} className="flex items-center justify-between">
                  <span>{c.name}</span>
                  <span className="text-muted-foreground">{c.minutes} min</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel sheen p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Habit streaks
          </h2>
          {streaks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No habits tracked yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {streaks.map((s) => (
                <li key={s.title} className="flex items-center justify-between">
                  <span>{s.title}</span>
                  <span className="text-muted-foreground">{s.days} days</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}
