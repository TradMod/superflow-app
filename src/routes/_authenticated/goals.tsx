import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Minus, Pencil, Plus, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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
import {
  categoriesQuery,
  currentUserId,
  goalMilestonesQuery,
  goalsQuery,
} from "@/lib/queries";
import {
  addDays,
  daysLeft,
  endOfMonth,
  fromDateKey,
  goalPace,
  goalProgress,
  GOAL_PERIODS,
  todayKey,
  type Goal,
  type GoalPeriod,
} from "@/lib/dayflow";

export const Route = createFileRoute("/_authenticated/goals")({
  head: () => ({
    meta: [
      { title: "Goals — DayFlow" },
      {
        name: "description",
        content: "Set weekly, monthly and yearly goals and track progress towards them.",
      },
      { property: "og:title", content: "Goals — DayFlow" },
      {
        property: "og:description",
        content: "Set weekly, monthly and yearly goals and track progress towards them.",
      },
    ],
  }),
  component: GoalsPage,
});

const PERIOD_LABEL: Record<GoalPeriod, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

function defaultTarget(period: GoalPeriod): string {
  const today = todayKey();
  if (period === "weekly") return addDays(today, 7);
  if (period === "monthly") return endOfMonth(today);
  return `${today.slice(0, 4)}-12-31`;
}

type Draft = {
  id?: string;
  title: string;
  notes: string;
  category_id: string;
  period: GoalPeriod;
  target_date: string;
  tracking: "numeric" | "checklist";
  target_value: string;
  current_value: string;
  unit: string;
};

const emptyDraft = (): Draft => ({
  title: "",
  notes: "",
  category_id: "none",
  period: "monthly",
  target_date: defaultTarget("monthly"),
  tracking: "numeric",
  target_value: "10",
  current_value: "0",
  unit: "",
});

const toDraft = (g: Goal): Draft => ({
  id: g.id,
  title: g.title,
  notes: g.notes ?? "",
  category_id: g.category_id ?? "none",
  period: g.period as GoalPeriod,
  target_date: g.target_date,
  tracking: g.tracking as "numeric" | "checklist",
  target_value: String(g.target_value),
  current_value: String(g.current_value),
  unit: g.unit ?? "",
});

function GoalsPage() {
  const qc = useQueryClient();
  const goals = useQuery(goalsQuery());
  const milestones = useQuery(goalMilestonesQuery());
  const categories = useQuery(categoriesQuery());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [newMilestone, setNewMilestone] = useState<Record<string, string>>({});

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["goals"] });
    void qc.invalidateQueries({ queryKey: ["goal_milestones"] });
  };

  const save = useMutation({
    mutationFn: async (d: Draft) => {
      if (!d.title.trim()) throw new Error("Give your goal a title.");
      const payload = {
        title: d.title.trim().slice(0, 140),
        notes: d.notes.trim().slice(0, 1000) || null,
        category_id: d.category_id === "none" ? null : d.category_id,
        period: d.period,
        target_date: d.target_date,
        tracking: d.tracking,
        target_value: d.tracking === "numeric" ? Number(d.target_value) || 1 : 1,
        current_value: d.tracking === "numeric" ? Number(d.current_value) || 0 : 0,
        unit: d.unit.trim().slice(0, 24) || null,
      };
      if (d.id) {
        const { error } = await supabase.from("goals").update(payload).eq("id", d.id);
        if (error) throw error;
      } else {
        const userId = await currentUserId();
        const { error } = await supabase
          .from("goals")
          .insert({ ...payload, user_id: userId, start_date: todayKey() });
        if (error) throw error;
      }
    },
    onSuccess: (_d, d) => {
      invalidate();
      setDraft(null);
      toast.success(d.id ? "Goal updated" : "Goal added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patchGoal = useMutation({
    mutationFn: async (input: { id: string; values: Record<string, unknown> }) => {
      const { error } = await supabase.from("goals").update(input.values).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const removeGoal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("goals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Goal deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addMilestone = useMutation({
    mutationFn: async (input: { goalId: string; title: string; position: number }) => {
      if (!input.title.trim()) throw new Error("Name the milestone first.");
      const { error } = await supabase.from("goal_milestones").insert({
        goal_id: input.goalId,
        title: input.title.trim().slice(0, 140),
        position: input.position,
      });
      if (error) throw error;
    },
    onSuccess: (_d, input) => {
      invalidate();
      setNewMilestone((s) => ({ ...s, [input.goalId]: "" }));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMilestone = useMutation({
    mutationFn: async (input: { id: string; done: boolean }) => {
      const { error } = await supabase
        .from("goal_milestones")
        .update({ done: input.done })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMilestone = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("goal_milestones").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const all = goals.data ?? [];
  const ms = milestones.data ?? [];
  const active = all.filter((g) => g.status === "active");
  const achieved = all.filter((g) => g.status === "achieved");

  const renderGoal = (goal: Goal) => {
    const progress = goalProgress(goal, ms);
    const pace = goalPace(goal, progress);
    const left = daysLeft(goal.target_date);
    const category = (categories.data ?? []).find((c) => c.id === goal.category_id);
    const mine = ms.filter((m) => m.goal_id === goal.id);

    return (
      <li key={goal.id} className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-medium">{goal.title}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{PERIOD_LABEL[goal.period as GoalPeriod]}</Badge>
              {category && <Badge variant="secondary">{category.name}</Badge>}
              <span>
                {fromDateKey(goal.target_date).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
                {goal.status === "active"
                  ? left >= 0
                    ? ` · ${left} day${left === 1 ? "" : "s"} left`
                    : " · past due"
                  : ""}
              </span>
              <span
                className={
                  pace === "behind"
                    ? "text-destructive"
                    : pace === "done"
                      ? "text-primary"
                      : "text-muted-foreground"
                }
              >
                {pace}
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Edit ${goal.title}`}
            onClick={() => setDraft(toDraft(goal))}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Delete ${goal.title}`}
            onClick={() => removeGoal.mutate(goal.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {goal.notes && <p className="mt-2 text-sm text-muted-foreground">{goal.notes}</p>}

        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {goal.tracking === "numeric"
                ? `${Number(goal.current_value)} / ${Number(goal.target_value)}${goal.unit ? ` ${goal.unit}` : ""}`
                : `${mine.filter((m) => m.done).length} / ${mine.length} milestones`}
            </span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} />
        </div>

        {goal.tracking === "numeric" && goal.status === "active" && (
          <div className="mt-3 flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label={`Decrease ${goal.title}`}
              onClick={() =>
                patchGoal.mutate({
                  id: goal.id,
                  values: { current_value: Math.max(0, Number(goal.current_value) - 1) },
                })
              }
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Input
              className="w-24"
              type="number"
              min={0}
              value={String(Number(goal.current_value))}
              aria-label={`Progress for ${goal.title}`}
              onChange={(e) =>
                patchGoal.mutate({
                  id: goal.id,
                  values: { current_value: Number(e.target.value) || 0 },
                })
              }
            />
            <Button
              variant="outline"
              size="icon"
              aria-label={`Increase ${goal.title}`}
              onClick={() =>
                patchGoal.mutate({
                  id: goal.id,
                  values: { current_value: Number(goal.current_value) + 1 },
                })
              }
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}

        {goal.tracking === "checklist" && (
          <div className="mt-3 space-y-2">
            <ul className="space-y-1.5">
              {mine.map((m) => (
                <li key={m.id} className="flex items-center gap-2 text-sm">
                  <button
                    type="button"
                    aria-label={m.done ? `Undo ${m.title}` : `Complete ${m.title}`}
                    onClick={() => toggleMilestone.mutate({ id: m.id, done: !m.done })}
                    className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border ${
                      m.done
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/40"
                    }`}
                  >
                    {m.done && <Check className="h-3 w-3" />}
                  </button>
                  <span className={`flex-1 ${m.done ? "line-through opacity-70" : ""}`}>
                    {m.title}
                  </span>
                  <button
                    type="button"
                    aria-label={`Delete ${m.title}`}
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => removeMilestone.mutate(m.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            {goal.status === "active" && (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  addMilestone.mutate({
                    goalId: goal.id,
                    title: newMilestone[goal.id] ?? "",
                    position: mine.length,
                  });
                }}
              >
                <Input
                  value={newMilestone[goal.id] ?? ""}
                  aria-label={`New milestone for ${goal.title}`}
                  placeholder="Add a milestone"
                  onChange={(e) =>
                    setNewMilestone((s) => ({ ...s, [goal.id]: e.target.value }))
                  }
                />
                <Button type="submit" variant="outline">
                  Add
                </Button>
              </form>
            )}
          </div>
        )}

        <div className="mt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              patchGoal.mutate({
                id: goal.id,
                values: { status: goal.status === "achieved" ? "active" : "achieved" },
              })
            }
          >
            {goal.status === "achieved" ? "Reopen goal" : "Mark achieved"}
          </Button>
        </div>
      </li>
    );
  };

  return (
    <AppShell
      title="Goals"
      subtitle="Bigger targets, separate from your daily routine"
      action={
        <Button onClick={() => setDraft(emptyDraft())}>
          <Plus className="mr-1 h-4 w-4" /> New
        </Button>
      }
    >
      {all.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <Target className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
          <p className="text-muted-foreground">
            No goals yet. Set a weekly, monthly or yearly target to work towards.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {GOAL_PERIODS.map((p) => {
            const items = active.filter((g) => g.period === p);
            if (items.length === 0) return null;
            return (
              <section key={p}>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {PERIOD_LABEL[p]}
                </h2>
                <ul className="space-y-3">{items.map(renderGoal)}</ul>
              </section>
            );
          })}
          {achieved.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Achieved
              </h2>
              <ul className="space-y-3">{achieved.map(renderGoal)}</ul>
            </section>
          )}
        </div>
      )}

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit goal" : "New goal"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="gtitle">Title</Label>
                <Input
                  id="gtitle"
                  maxLength={140}
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="Read 4 books"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Period</Label>
                  <Select
                    value={draft.period}
                    onValueChange={(v) =>
                      setDraft({
                        ...draft,
                        period: v as GoalPeriod,
                        target_date: defaultTarget(v as GoalPeriod),
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GOAL_PERIODS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {PERIOD_LABEL[p]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gtarget">Target date</Label>
                  <Input
                    id="gtarget"
                    type="date"
                    value={draft.target_date}
                    onChange={(e) => setDraft({ ...draft, target_date: e.target.value })}
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
                <Label>Track progress by</Label>
                <Select
                  value={draft.tracking}
                  onValueChange={(v) =>
                    setDraft({ ...draft, tracking: v as "numeric" | "checklist" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="numeric">A number target</SelectItem>
                    <SelectItem value="checklist">A milestone checklist</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {draft.tracking === "numeric" && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="gcur">Current</Label>
                    <Input
                      id="gcur"
                      type="number"
                      min={0}
                      value={draft.current_value}
                      onChange={(e) => setDraft({ ...draft, current_value: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="gtar">Target</Label>
                    <Input
                      id="gtar"
                      type="number"
                      min={1}
                      value={draft.target_value}
                      onChange={(e) => setDraft({ ...draft, target_value: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="gunit">Unit</Label>
                    <Input
                      id="gunit"
                      maxLength={24}
                      value={draft.unit}
                      placeholder="books"
                      onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {draft.tracking === "checklist" && !draft.id && (
                <p className="text-xs text-muted-foreground">
                  Save the goal, then add milestones to it from the list.
                </p>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="gnotes">Notes</Label>
                <Textarea
                  id="gnotes"
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
              {save.isPending ? "Saving…" : draft?.id ? "Save changes" : "Add goal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
