import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  Plus,
  Repeat,
  SkipForward,
  X,
} from "lucide-react";
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
import {
  categoriesQuery,
  currentUserId,
  occurrencesQuery,
  overridesQuery,
  subtaskLogsQuery,
  subtasksQuery,
  tasksQuery,
} from "@/lib/queries";
import {
  addDays,
  buildDay,
  computeDayStats,
  computeStreak,
  formatTime,
  fromDateKey,
  isSubtaskDone,
  subtasksForDay,
  todayKey,
  type DayItem,
} from "@/lib/dayflow";

export const Route = createFileRoute("/_authenticated/today")({
  head: () => ({
    meta: [
      { title: "Today — SuperFlow" },
      { name: "description", content: "Your routines, schedule and daily subtasks for today." },
      { property: "og:title", content: "Today — SuperFlow" },
      {
        property: "og:description",
        content: "Your routines, schedule and daily subtasks for today.",
      },
    ],
  }),
  component: TodayPage,
});

function TodayPage() {
  const qc = useQueryClient();
  const realToday = todayKey();
  const [today, setToday] = useState(realToday);
  const from = addDays(today < realToday ? today : realToday, -60);
  const to = today > realToday ? today : realToday;

  const tasks = useQuery(tasksQuery());
  const occurrences = useQuery(occurrencesQuery(from, to));
  const categories = useQuery(categoriesQuery());
  const overrides = useQuery(overridesQuery());
  const subtasks = useQuery(subtasksQuery());
  const subtaskLogs = useQuery(subtaskLogsQuery(today, today));

  const [active, setActive] = useState<DayItem | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newRecurring, setNewRecurring] = useState(false);
  const [oneOff, setOneOff] = useState("");

  const isPast = today < realToday;
  const isFuture = today > realToday;

  const items = useMemo(
    () => buildDay(tasks.data ?? [], occurrences.data ?? [], today, overrides.data ?? []),
    [tasks.data, occurrences.data, overrides.data, today],
  );
  const stats = useMemo(
    () => computeDayStats(items, categories.data ?? [], today),
    [items, categories.data, today],
  );

  const addOneOffTask = useMutation({
    mutationFn: async (title: string) => {
      if (!title.trim()) throw new Error("Name the task first.");
      const userId = await currentUserId();
      const { error } = await supabase.from("tasks").insert({
        user_id: userId,
        title: title.trim().slice(0, 140),
        repeat_kind: "none",
        start_date: today,
        end_date: today,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tasks"] });
      setOneOff("");
      toast.success("Task added to this day.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

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

  const invalidateSubtasks = () => {
    void qc.invalidateQueries({ queryKey: ["task_subtasks"] });
    void qc.invalidateQueries({ queryKey: ["task_subtask_logs"] });
  };

  const addSubtask = useMutation({
    mutationFn: async (input: { taskId: string; title: string; recurring: boolean; position: number }) => {
      if (!input.title.trim()) throw new Error("Name the subtask first.");
      const userId = await currentUserId();
      const { error } = await supabase.from("task_subtasks").insert({
        user_id: userId,
        task_id: input.taskId,
        title: input.title.trim().slice(0, 140),
        recurring: input.recurring,
        for_date: input.recurring ? null : today,
        position: input.position,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateSubtasks();
      setNewTitle("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleSubtask = useMutation({
    mutationFn: async (input: { subtaskId: string; done: boolean }) => {
      const userId = await currentUserId();
      const { error } = await supabase.from("task_subtask_logs").upsert(
        {
          user_id: userId,
          subtask_id: input.subtaskId,
          log_date: today,
          done: input.done,
        },
        { onConflict: "subtask_id,log_date" },
      );
      if (error) throw error;
    },
    onSuccess: invalidateSubtasks,
    onError: (e: Error) => toast.error(e.message),
  });

  const removeSubtask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("task_subtasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidateSubtasks,
    onError: (e: Error) => toast.error(e.message),
  });

  const loading = tasks.isLoading || occurrences.isLoading;
  const allSubtasks = subtasks.data ?? [];
  const logs = subtaskLogs.data ?? [];

  return (
    <AppShell
      title={fromDateKey(today).toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      })}
      subtitle={`${stats.done} of ${stats.planned} done · ${stats.minutes} min logged`}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous day"
          onClick={() => setToday(addDays(today, -1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Next day"
          onClick={() => setToday(addDays(today, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Input
          type="date"
          aria-label="Jump to date"
          className="w-auto"
          value={today}
          onChange={(e) => e.target.value && setToday(e.target.value)}
        />
        {today !== realToday && (
          <Button variant="ghost" size="sm" onClick={() => setToday(realToday)}>
            Today
          </Button>
        )}
        {isPast && <Badge variant="secondary">Past day · editable</Badge>}
        {isFuture && <Badge variant="secondary">Planning ahead</Badge>}
      </div>

      <div className="mb-6 panel sheen p-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Day progress</p>
            <p className="font-display text-lg font-semibold font-semibold font-semibold">{stats.completionRate}%</p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <p>{stats.minutes} minutes logged</p>
            <p>Avg effort {stats.avgEffort ?? "—"}</p>
          </div>
        </div>
        <Progress value={stats.completionRate} className="mt-4" />
      </div>

      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          addOneOffTask.mutate(oneOff);
        }}
      >
        <Input
          value={oneOff}
          aria-label="Add a task just for this day"
          placeholder="Add a task just for this day…"
          onChange={(e) => setOneOff(e.target.value)}
        />
        <Button type="submit" variant="outline" disabled={addOneOffTask.isPending}>
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </form>


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
            const subs = subtasksForDay(allSubtasks, item.task.id, today);
            const subsDone = subs.filter((s) => isSubtaskDone(logs, s.id, today)).length;
            const isAdding = adding === item.task.id;
            return (
              <li
                key={item.task.id}
                className={`panel sheen p-4 transition-colors ${
                  item.status === "done" ? "opacity-70" : ""
                }`}
              >
                <div className="flex items-start gap-3">
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
                      {subs.length > 0 && (
                        <span>
                          {subsDone}/{subs.length} subtasks
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
                </div>

                <div className="mt-2 space-y-1.5 pl-9">
                  {subs.map((s) => {
                    const done = isSubtaskDone(logs, s.id, today);
                    return (
                      <div key={s.id} className="flex items-center gap-2 text-sm">
                        <button
                          type="button"
                          aria-label={done ? `Undo ${s.title}` : `Complete ${s.title}`}
                          onClick={() => toggleSubtask.mutate({ subtaskId: s.id, done: !done })}
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            done
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-muted-foreground/40"
                          }`}
                        >
                          {done && <Check className="h-3 w-3" />}
                        </button>
                        <span className={`flex-1 ${done ? "line-through opacity-70" : ""}`}>
                          {s.title}
                        </span>
                        {s.recurring && (
                          <Repeat className="h-3 w-3 text-muted-foreground" aria-label="repeats daily" />
                        )}
                        <button
                          type="button"
                          aria-label={`Delete ${s.title}`}
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => removeSubtask.mutate(s.id)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}

                  {isAdding ? (
                    <form
                      className="space-y-2 pt-1"
                      onSubmit={(e) => {
                        e.preventDefault();
                        addSubtask.mutate({
                          taskId: item.task.id,
                          title: newTitle,
                          recurring: newRecurring,
                          position: subs.length,
                        });
                      }}
                    >
                      <div className="flex gap-2">
                        <Input
                          autoFocus
                          value={newTitle}
                          aria-label={`New subtask for ${item.task.title}`}
                          placeholder="e.g. Finish bug report"
                          onChange={(e) => setNewTitle(e.target.value)}
                        />
                        <Button type="submit" variant="outline" size="sm">
                          Add
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setAdding(null);
                            setNewTitle("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={newRecurring}
                          onChange={(e) => setNewRecurring(e.target.checked)}
                        />
                        Repeat this subtask every day
                      </label>
                    </form>
                  ) : (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setAdding(item.task.id);
                        setNewTitle("");
                        setNewRecurring(false);
                      }}
                    >
                      <Plus className="h-3 w-3" /> Add subtask
                    </button>
                  )}
                </div>
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
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="How did it go? Your coach reads these."
            />
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
