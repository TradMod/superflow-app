import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Check, Clock, Flame, SkipForward } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { categoriesQuery, currentUserId, occurrencesQuery, overridesQuery, remindersQuery, tasksQuery } from "@/lib/queries";
import {
  addDays,
  buildDay,
  computeDayStats,
  computeStreak,
  formatTime,
  todayKey,
  type DayItem,
} from "@/lib/dayflow";

export const Route = createFileRoute("/_authenticated/today")({
  head: () => ({
    meta: [
      { title: "Today — DayFlow" },
      { name: "description", content: "Your routines, schedule and reminders for today." },
      { property: "og:title", content: "Today — DayFlow" },
      { property: "og:description", content: "Your routines, schedule and reminders for today." },
    ],
  }),
  component: TodayPage,
});

function TodayPage() {
  const qc = useQueryClient();
  const today = todayKey();
  const from = addDays(today, -60);

  const tasks = useQuery(tasksQuery());
  const occurrences = useQuery(occurrencesQuery(from, today));
  const categories = useQuery(categoriesQuery());
  const reminders = useQuery(remindersQuery());
  const overrides = useQuery(overridesQuery());

  const [active, setActive] = useState<DayItem | null>(null);

  const items = useMemo(
    () => buildDay(tasks.data ?? [], occurrences.data ?? [], today, overrides.data ?? []),
    [tasks.data, occurrences.data, overrides.data, today],
  );
  const stats = useMemo(
    () => computeDayStats(items, categories.data ?? [], today),
    [items, categories.data, today],
  );

  const dueReminders = (reminders.data ?? []).filter((r) => !r.done && r.due_date <= today);

  const setStatus = useMutation({
    mutationFn: async (input: {
      item: DayItem;
      status: "pending" | "done" | "skipped";
      effort?: number | null;
      minutes?: number | null;
      note?: string | null;
    }) => {
      const userId = await currentUserId();
      const { error } = await supabase.from("task_occurrences").upsert(
        {
          user_id: userId,
          task_id: input.item.task.id,
          occurrence_date: today,
          status: input.status,
          effort: input.effort ?? null,
          minutes_spent: input.minutes ?? null,
          note: input.note ?? null,
          completed_at: input.status === "done" ? new Date().toISOString() : null,
        },
        { onConflict: "task_id,occurrence_date" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["occurrences"] });
      setActive(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const loading = tasks.isLoading || occurrences.isLoading;

  return (
    <AppShell
      title={new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
      subtitle={`${stats.done} of ${stats.planned} done · ${stats.minutes} min logged`}
    >
      <div className="mb-6 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Day progress</p>
            <p className="font-display text-4xl">{stats.completionRate}%</p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <p>{stats.minutes} minutes logged</p>
            <p>Avg effort {stats.avgEffort ?? "—"}</p>
          </div>
        </div>
        <Progress value={stats.completionRate} className="mt-4" />
      </div>

      {dueReminders.length > 0 && (
        <div className="mb-6 rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
            Reminders due
          </p>
          <ul className="space-y-1 text-sm">
            {dueReminders.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3">
                <span>
                  {r.title}
                  {r.due_date < today ? " (overdue)" : ""}
                </span>
                <span className="text-muted-foreground">{formatTime(r.due_time) ?? r.due_date}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading your day…</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-muted-foreground">
            Nothing scheduled today. Add routines and schedules from the Plan tab.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const category = (categories.data ?? []).find((c) => c.id === item.task.category_id);
            const streak = item.task.is_habit
              ? computeStreak(item.task, occurrences.data ?? [], today, overrides.data ?? [])
              : 0;
            return (
              <li
                key={item.task.id}
                className={`flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors ${
                  item.status === "done" ? "opacity-70" : ""
                }`}
              >
                <button
                  type="button"
                  aria-label={item.status === "done" ? "Mark as not done" : `Complete ${item.task.title}`}
                  onClick={() =>
                    item.status === "done"
                      ? setStatus.mutate({ item, status: "pending" })
                      : setActive(item)
                  }
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all ${
                    item.status === "done"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/40 hover:border-primary"
                  }`}
                >
                  {item.status === "done" && <Check className="h-3.5 w-3.5" />}
                </button>

                <div className="min-w-0 flex-1">
                  <p className={`font-medium ${item.status === "done" ? "line-through" : ""}`}>
                    {item.task.title}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {item.task.start_time && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime(item.task.start_time)}
                        {item.task.end_time ? ` – ${formatTime(item.task.end_time)}` : ""}
                      </span>
                    )}
                    {category && <Badge variant="secondary">{category.name}</Badge>}
                    {item.task.is_habit && streak > 0 && (
                      <span className="inline-flex items-center gap-1 text-primary">
                        <Flame className="h-3 w-3" /> {streak}d streak
                      </span>
                    )}
                    {item.status === "done" && item.occurrence && (
                      <span>
                        effort {item.occurrence.effort ?? "—"} · {item.occurrence.minutes_spent ?? 0}m
                      </span>
                    )}
                    {item.status === "skipped" && <span>skipped</span>}
                  </div>
                </div>

                {item.status === "pending" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Skip ${item.task.title}`}
                    onClick={() => setStatus.mutate({ item, status: "skipped" })}
                  >
                    <SkipForward className="h-4 w-4" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <CompleteDialog
        item={active}
        onClose={() => setActive(null)}
        onSave={(effort, minutes, note) =>
          active && setStatus.mutate({ item: active, status: "done", effort, minutes, note })
        }
        saving={setStatus.isPending}
      />
    </AppShell>
  );
}

function CompleteDialog({
  item,
  onClose,
  onSave,
  saving,
}: {
  item: DayItem | null;
  onClose: () => void;
  onSave: (effort: number, minutes: number | null, note: string | null) => void;
  saving: boolean;
}) {
  const [effort, setEffort] = useState(3);
  const [minutes, setMinutes] = useState("");
  const [note, setNote] = useState("");

  return (
    <Dialog
      open={!!item}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
          setEffort(3);
          setMinutes("");
          setNote("");
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item?.task.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div>
            <Label>Effort · {effort}/5</Label>
            <Slider
              className="mt-3"
              min={1}
              max={5}
              step={1}
              value={[effort]}
              onValueChange={(v) => setEffort(v[0] ?? 3)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="minutes">Minutes spent</Label>
            <Input
              id="minutes"
              type="number"
              min={0}
              inputMode="numeric"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              placeholder="30"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={saving}
            onClick={() => onSave(effort, minutes === "" ? null : Number(minutes), note || null)}
          >
            {saving ? "Saving…" : "Mark done"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
