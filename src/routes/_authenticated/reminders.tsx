import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
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
import { currentUserId, remindersQuery } from "@/lib/queries";
import { formatTime, fromDateKey, todayKey, type Reminder } from "@/lib/dayflow";

export const Route = createFileRoute("/_authenticated/reminders")({
  head: () => ({
    meta: [
      { title: "Reminders — DayFlow" },
      { name: "description", content: "Park anything on a future date and get nudged when it's due." },
      { property: "og:title", content: "Reminders — DayFlow" },
      { property: "og:description", content: "Park anything on a future date and get nudged when it's due." },
    ],
  }),
  component: RemindersPage,
});

type Draft = {
  id?: string;
  title: string;
  notes: string;
  due_date: string;
  due_time: string;
};

const emptyDraft = (): Draft => ({ title: "", notes: "", due_date: todayKey(), due_time: "" });

const toDraft = (r: Reminder): Draft => ({
  id: r.id,
  title: r.title,
  notes: r.notes ?? "",
  due_date: r.due_date,
  due_time: r.due_time?.slice(0, 5) ?? "",
});

function RemindersPage() {
  const qc = useQueryClient();
  const today = todayKey();
  const reminders = useQuery(remindersQuery());
  const [draft, setDraft] = useState<Draft | null>(null);

  const save = useMutation({
    mutationFn: async (d: Draft) => {
      if (!d.title.trim()) throw new Error("Give your reminder a title.");
      const payload = {
        title: d.title.trim().slice(0, 120),
        notes: d.notes.trim().slice(0, 1000) || null,
        due_date: d.due_date,
        due_time: d.due_time || null,
      };
      if (d.id) {
        const { error } = await supabase.from("reminders").update(payload).eq("id", d.id);
        if (error) throw error;
      } else {
        const userId = await currentUserId();
        const { error } = await supabase.from("reminders").insert({ ...payload, user_id: userId });
        if (error) throw error;
      }
    },
    onSuccess: (_data, d) => {
      void qc.invalidateQueries({ queryKey: ["reminders"] });
      setDraft(null);
      toast.success(d.id ? "Reminder updated" : "Reminder added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (input: { id: string; done: boolean }) => {
      const { error } = await supabase
        .from("reminders")
        .update({ done: input.done })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["reminders"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reminders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["reminders"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const all = reminders.data ?? [];
  const groups = [
    { label: "Overdue", items: all.filter((r) => !r.done && r.due_date < today) },
    { label: "Today", items: all.filter((r) => !r.done && r.due_date === today) },
    { label: "Upcoming", items: all.filter((r) => !r.done && r.due_date > today) },
    { label: "Done", items: all.filter((r) => r.done) },
  ].filter((g) => g.items.length > 0);

  return (
    <AppShell
      title="Reminders"
      subtitle="Things waiting on a date"
      action={
        <Button onClick={() => setDraft(emptyDraft())}>
          <Plus className="mr-1 h-4 w-4" /> New
        </Button>
      }
    >
      {all.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-muted-foreground">No reminders yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.label}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {group.label}
              </h2>
              <ul className="space-y-2">
                {group.items.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-start gap-3 rounded-xl border border-border bg-card p-4"
                  >
                    <button
                      type="button"
                      aria-label={r.done ? `Reopen ${r.title}` : `Complete ${r.title}`}
                      onClick={() => toggle.mutate({ id: r.id, done: !r.done })}
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                        r.done
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/40"
                      }`}
                    >
                      {r.done && <Check className="h-3 w-3" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={`font-medium ${r.done ? "line-through opacity-70" : ""}`}>
                        {r.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {fromDateKey(r.due_date).toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                        {r.due_time ? ` · ${formatTime(r.due_time)}` : ""}
                      </p>
                      {r.notes && <p className="mt-1 text-sm text-muted-foreground">{r.notes}</p>}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${r.title}`}
                      onClick={() => setDraft(toDraft(r))}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${r.title}`}
                      onClick={() => remove.mutate(r.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit reminder" : "New reminder"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="rtitle">Title</Label>
                <Input
                  id="rtitle"
                  maxLength={120}
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="Renew passport"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="rdate">Date</Label>
                  <Input
                    id="rdate"
                    type="date"
                    value={draft.due_date}
                    onChange={(e) => setDraft({ ...draft, due_date: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rtime">Time (optional)</Label>
                  <Input
                    id="rtime"
                    type="time"
                    value={draft.due_time}
                    onChange={(e) => setDraft({ ...draft, due_time: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rnotes">Notes</Label>
                <Textarea
                  id="rnotes"
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
              {save.isPending ? "Saving…" : draft?.id ? "Save changes" : "Add reminder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
