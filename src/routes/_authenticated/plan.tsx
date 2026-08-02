import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus, Repeat, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { categoriesQuery, currentUserId, tasksQuery } from "@/lib/queries";
import {
  formatTime,
  todayKey,
  WEEKDAY_LABELS,
  type RepeatKind,
  type Task,
} from "@/lib/dayflow";

export const Route = createFileRoute("/_authenticated/plan")({
  head: () => ({
    meta: [
      { title: "Plan — DayFlow" },
      { name: "description", content: "Create routines and repeating schedules for your days." },
      { property: "og:title", content: "Plan — DayFlow" },
      { property: "og:description", content: "Create routines and repeating schedules for your days." },
    ],
  }),
  component: PlanPage,
});

const REPEAT_LABEL: Record<RepeatKind, string> = {
  none: "One-off",
  daily: "Every day",
  weekdays: "Weekdays",
  weekly: "Selected days",
  monthly: "Monthly",
};

type Draft = {
  id?: string;
  title: string;
  notes: string;
  category_id: string;
  start_time: string;
  end_time: string;
  repeat_kind: RepeatKind;
  repeat_days: number[];
  repeat_day_of_month: string;
  start_date: string;
  end_date: string;
  priority: string;
  is_habit: boolean;
};

const emptyDraft = (): Draft => ({
  title: "",
  notes: "",
  category_id: "none",
  start_time: "",
  end_time: "",
  repeat_kind: "daily",
  repeat_days: [1, 2, 3, 4, 5],
  repeat_day_of_month: "1",
  start_date: todayKey(),
  end_date: "",
  priority: "2",
  is_habit: true,
});

function toDraft(task: Task): Draft {
  return {
    id: task.id,
    title: task.title,
    notes: task.notes ?? "",
    category_id: task.category_id ?? "none",
    start_time: task.start_time?.slice(0, 5) ?? "",
    end_time: task.end_time?.slice(0, 5) ?? "",
    repeat_kind: task.repeat_kind as RepeatKind,
    repeat_days: task.repeat_days ?? [],
    repeat_day_of_month: String(task.repeat_day_of_month ?? 1),
    start_date: task.start_date,
    end_date: task.end_date ?? "",
    priority: String(task.priority),
    is_habit: task.is_habit,
  };
}

function PlanPage() {
  const qc = useQueryClient();
  const tasks = useQuery(tasksQuery());
  const categories = useQuery(categoriesQuery());
  const [draft, setDraft] = useState<Draft | null>(null);

  const save = useMutation({
    mutationFn: async (d: Draft) => {
      if (!d.title.trim()) throw new Error("Give your task a title.");
      const userId = await currentUserId();
      const payload = {
        user_id: userId,
        title: d.title.trim().slice(0, 120),
        notes: d.notes.trim().slice(0, 1000) || null,
        category_id: d.category_id === "none" ? null : d.category_id,
        start_time: d.start_time || null,
        end_time: d.end_time || null,
        repeat_kind: d.repeat_kind,
        repeat_days: d.repeat_kind === "weekly" ? d.repeat_days : [],
        repeat_day_of_month:
          d.repeat_kind === "monthly" ? Number(d.repeat_day_of_month) || 1 : null,
        start_date: d.start_date,
        end_date: d.end_date || null,
        priority: Number(d.priority),
        is_habit: d.is_habit,
      };
      const { error } = d.id
        ? await supabase.from("tasks").update(payload).eq("id", d.id)
        : await supabase.from("tasks").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tasks"] });
      setDraft(null);
      toast.success("Saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").update({ archived: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell
      title="Plan"
      subtitle="Routines and schedules that build your days"
      action={
        <Button onClick={() => setDraft(emptyDraft())}>
          <Plus className="mr-1 h-4 w-4" /> New
        </Button>
      }
    >
      {tasks.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (tasks.data ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-muted-foreground">
            No tasks yet. Add your first routine to start building your day.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {(tasks.data ?? []).map((task) => {
            const category = (categories.data ?? []).find((c) => c.id === task.category_id);
            return (
              <li
                key={task.id}
                className="flex items-start gap-3 rounded-xl border border-border bg-card p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{task.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Repeat className="h-3 w-3" />
                      {REPEAT_LABEL[task.repeat_kind as RepeatKind]}
                      {task.repeat_kind === "weekly" && (task.repeat_days ?? []).length > 0
                        ? ` · ${(task.repeat_days ?? []).map((d) => WEEKDAY_LABELS[d]).join(", ")}`
                        : ""}
                    </span>
                    {task.start_time && <span>{formatTime(task.start_time)}</span>}
                    {category && <Badge variant="secondary">{category.name}</Badge>}
                    {task.is_habit && <Badge variant="outline">habit</Badge>}
                  </div>
                </div>
                <Button variant="ghost" size="icon" aria-label={`Edit ${task.title}`} onClick={() => setDraft(toDraft(task))}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${task.title}`}
                  onClick={() => remove.mutate(task.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit task" : "New task"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  maxLength={120}
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="Morning run"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="start">Start time</Label>
                  <Input
                    id="start"
                    type="time"
                    value={draft.start_time}
                    onChange={(e) => setDraft({ ...draft, start_time: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="end">End time</Label>
                  <Input
                    id="end"
                    type="time"
                    value={draft.end_time}
                    onChange={(e) => setDraft({ ...draft, end_time: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select
                  value={draft.category_id}
                  onValueChange={(v) => setDraft({ ...draft, category_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Uncategorised</SelectItem>
                    {(categories.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Repeats</Label>
                <Select
                  value={draft.repeat_kind}
                  onValueChange={(v) => setDraft({ ...draft, repeat_kind: v as RepeatKind })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(REPEAT_LABEL) as RepeatKind[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {REPEAT_LABEL[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {draft.repeat_kind === "weekly" && (
                <div className="flex flex-wrap gap-2">
                  {WEEKDAY_LABELS.map((label, index) => {
                    const on = draft.repeat_days.includes(index);
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            repeat_days: on
                              ? draft.repeat_days.filter((d) => d !== index)
                              : [...draft.repeat_days, index].sort(),
                          })
                        }
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                          on
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}

              {draft.repeat_kind === "monthly" && (
                <div className="space-y-1.5">
                  <Label htmlFor="dom">Day of month</Label>
                  <Input
                    id="dom"
                    type="number"
                    min={1}
                    max={31}
                    value={draft.repeat_day_of_month}
                    onChange={(e) => setDraft({ ...draft, repeat_day_of_month: e.target.value })}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sd">Starts</Label>
                  <Input
                    id="sd"
                    type="date"
                    value={draft.start_date}
                    onChange={(e) => setDraft({ ...draft, start_date: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ed">Ends (optional)</Label>
                  <Input
                    id="ed"
                    type="date"
                    value={draft.end_date}
                    onChange={(e) => setDraft({ ...draft, end_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select
                  value={draft.priority}
                  onValueChange={(v) => setDraft({ ...draft, priority: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Low</SelectItem>
                    <SelectItem value="2">Normal</SelectItem>
                    <SelectItem value="3">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border p-3">
                <div>
                  <p className="text-sm font-medium">Track as habit</p>
                  <p className="text-xs text-muted-foreground">Counts toward streaks</p>
                </div>
                <Switch
                  checked={draft.is_habit}
                  onCheckedChange={(v) => setDraft({ ...draft, is_habit: v })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  rows={2}
                  maxLength={1000}
                  value={draft.notes}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button disabled={save.isPending} onClick={() => draft && save.mutate(draft)}>
              {save.isPending ? "Saving…" : "Save task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
