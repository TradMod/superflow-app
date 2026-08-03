import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { occurrencesQuery, overridesQuery, remindersQuery, tasksQuery } from "@/lib/queries";
import { buildDay, formatTime, fromDateKey, toDateKey, todayKey } from "@/lib/dayflow";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar — DayFlow" },
      { name: "description", content: "See your schedule and reminders across the month." },
      { property: "og:title", content: "Calendar — DayFlow" },
      { property: "og:description", content: "See your schedule and reminders across the month." },
    ],
  }),
  component: CalendarPage,
});

function CalendarPage() {
  const today = todayKey();
  const [cursor, setCursor] = useState(() => {
    const d = fromDateKey(today);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState(today);

  const monthStart = toDateKey(cursor);
  const monthEnd = toDateKey(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0));

  const tasks = useQuery(tasksQuery());
  const occurrences = useQuery(occurrencesQuery(monthStart, monthEnd));
  const reminders = useQuery(remindersQuery());
  const overrides = useQuery(overridesQuery());

  const days = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const total = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const lead = first.getDay();
    const cells: (string | null)[] = Array.from({ length: lead }, () => null);
    for (let i = 1; i <= total; i++) {
      cells.push(toDateKey(new Date(cursor.getFullYear(), cursor.getMonth(), i)));
    }
    return cells;
  }, [cursor]);

  const selectedItems = buildDay(tasks.data ?? [], occurrences.data ?? [], selected, overrides.data ?? []);
  const selectedReminders = (reminders.data ?? []).filter((r) => r.due_date === selected);

  return (
    <AppShell title="Calendar" subtitle="Everything on your future days">
      <div className="mb-4 flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Previous month"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <p className="font-display text-2xl">
          {cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </p>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Next month"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {days.map((key, i) => {
          if (!key) return <span key={`e${i}`} />;
          const count = buildDay(tasks.data ?? [], occurrences.data ?? [], key, overrides.data ?? []).length;
          const hasReminder = (reminders.data ?? []).some((r) => r.due_date === key && !r.done);
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelected(key)}
              className={`aspect-square rounded-xl border p-1 text-sm transition-colors ${
                key === selected
                  ? "border-primary bg-primary/10"
                  : key === today
                    ? "border-primary/40"
                    : "border-border hover:bg-accent"
              }`}
            >
              <span className={key === today ? "font-semibold text-primary" : ""}>
                {Number(key.slice(-2))}
              </span>
              <span className="mt-1 flex items-center justify-center gap-0.5">
                {count > 0 && <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />}
                {hasReminder && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        <h2 className="mb-3 font-display text-2xl">
          {fromDateKey(selected).toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </h2>
        {selectedItems.length === 0 && selectedReminders.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing scheduled on this day.</p>
        ) : (
          <ul className="space-y-2">
            {selectedItems.map((item) => (
              <li
                key={item.task.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 text-sm"
              >
                <span>{item.task.title}</span>
                <span className="text-xs text-muted-foreground">
                  {formatTime(item.task.start_time) ?? "anytime"}
                  {item.status !== "pending" ? ` · ${item.status}` : ""}
                </span>
              </li>
            ))}
            {selectedReminders.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm"
              >
                <span>{r.title}</span>
                <Badge variant="secondary">reminder</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
