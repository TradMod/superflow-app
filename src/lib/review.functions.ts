import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const StatsInput = z.object({
  period: z.enum(["day", "week", "month"]),
  periodStart: z.string().min(8),
  label: z.string(),
  planned: z.number(),
  done: z.number(),
  skipped: z.number(),
  completionRate: z.number(),
  minutes: z.number(),
  avgEffort: z.number().nullable(),
  excusedDays: z.number(),
  byCategory: z.array(z.object({ name: z.string(), minutes: z.number(), done: z.number() })),
  perDay: z.array(
    z.object({ dateKey: z.string(), planned: z.number(), done: z.number(), completionRate: z.number(), minutes: z.number() }),
  ),
  habits: z.array(
    z.object({ title: z.string(), done: z.number(), scheduled: z.number(), rate: z.number() }),
  ),
  bestDay: z.string().nullable(),
  worstDay: z.string().nullable(),
  events: z.array(z.string()),
  completed: z.array(z.string()),
  missed: z.array(z.string()),
  tomorrowTasks: z.array(z.string()),
  streaks: z.array(z.object({ title: z.string(), days: z.number() })),
  notes: z.array(z.string()).default([]),
  effortByTask: z
    .array(
      z.object({
        title: z.string(),
        avgEffort: z.number(),
        minutes: z.number(),
        times: z.number(),
      }),
    )
    .default([]),
  subtasks: z
    .array(z.object({ parent: z.string(), title: z.string(), done: z.boolean() }))
    .default([]),
});

type Stats = z.infer<typeof StatsInput>;

const COACH = [
  "You are the user's personal coach and accountability partner inside SuperFlow.",
  "You are warm underneath but brutally honest on the surface: a motivational speaker who refuses to flatter.",
  "Call out excuses directly, name the exact tasks and numbers, and never pad with generic praise.",
  "Weigh effort levels (1-5) as heavily as completion: high effort on few tasks is respectable, low effort everywhere is coasting, and high effort with low completion means the plan is wrong, not the person.",
  "Read the user's own notes closely and respond to what they actually wrote — quote or reference them.",
  "Days excused by events are deliberate, never failures. Do not scold those.",
  "Plain text only, no markdown, no greetings, no sign-off. Second person.",
].join(" ");

const SYSTEM: Record<Stats["period"], string> = {
  day: `${COACH} Write a daily review with three labelled parts: 'Straight talk', 'What it cost you', and 'Tomorrow'. Under 180 words, ending with 2-3 concrete, non-negotiable actions for tomorrow.`,
  week: `${COACH} Write a weekly review with three labelled parts: 'Straight talk', 'Patterns and effort', and 'Next week'. Focus on patterns across days, habit consistency and where effort dropped. Under 220 words, ending with 2-3 concrete adjustments.`,
  month: `${COACH} Write a monthly review with three labelled parts: 'Straight talk', 'Trend and drift', and 'Next month'. Focus on how the month trended week over week, which habits held, and where effort and time really went. Under 240 words, ending with 2-3 concrete changes.`,
};

function buildPrompt(data: Stats): string {
  const lines = [
    `Period: ${data.period} (${data.label})`,
    `Planned tasks: ${data.planned}, completed: ${data.done}, skipped: ${data.skipped} (${data.completionRate}% completion)`,
    `Total time logged: ${data.minutes} minutes. Average effort (1-5): ${data.avgEffort ?? "not recorded"}`,
    `Time by category: ${data.byCategory.map((c) => `${c.name} ${c.minutes}m (${c.done} tasks)`).join(", ") || "none"}`,
    `Habit consistency: ${data.habits.map((h) => `${h.title} ${h.done}/${h.scheduled} days (${h.rate}%)`).join(", ") || "none"}`,
    `Live habit streaks: ${data.streaks.map((s) => `${s.title} ${s.days}d`).join(", ") || "none"}`,
    `Effort per task (avg 1-5): ${data.effortByTask.map((e) => `${e.title} ${e.avgEffort}/5 over ${e.times} time(s), ${e.minutes}m`).join(", ") || "none recorded"}`,
    `User's own notes (their words — respond to these): ${data.notes.join(" | ") || "none written"}`,
    `Days excused by events: ${data.excusedDays}${data.events.length ? ` (${data.events.join(", ")}) — these were deliberately taken off, do not treat them as failures` : ""}`,
  ];

  if (data.period === "day") {
    lines.push(
      `Completed: ${data.completed.join(", ") || "nothing"}`,
      `Not completed: ${data.missed.join(", ") || "nothing"}`,
      `Subtasks today: ${data.subtasks.map((t) => `${t.parent} → ${t.title} ${t.done ? "done" : "not done"}`).join(", ") || "none"}`,
      `On the table tomorrow — tasks: ${data.tomorrowTasks.join(", ") || "nothing scheduled yet"}`,
    );
  } else {
    lines.push(
      `Day by day: ${data.perDay.map((d) => `${d.dateKey} ${d.done}/${d.planned} (${d.completionRate}%, ${d.minutes}m)`).join("; ") || "no data"}`,
      `Best day: ${data.bestDay ?? "n/a"}, weakest day: ${data.worstDay ?? "n/a"}`,
      `Frequently missed: ${data.missed.slice(0, 15).join(", ") || "nothing"}`,
    );
  }

  return lines.join("\n");
}

export const generatePeriodSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StatsInput.parse(input))
  .handler(async ({ data, context }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured for this app yet.");

    const gateway = createLovableAiGatewayProvider(key);

    let text: string;
    try {
      const result = await generateText({
        model: gateway("google/gemini-3.5-flash"),
        system: SYSTEM[data.period],
        prompt: buildPrompt(data),
      });
      text = result.text.trim();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("429")) throw new Error("AI is busy right now — try again in a moment.");
      if (message.includes("402")) throw new Error("AI credits are exhausted for this workspace.");
      throw new Error("Could not generate your review.");
    }

    const { error } = await context.supabase.from("period_reviews").upsert(
      {
        user_id: context.userId,
        period: data.period,
        period_start: data.periodStart,
        stats: JSON.parse(JSON.stringify(data)),
        summary: text,
      },
      { onConflict: "user_id,period,period_start" },
    );
    if (error) throw new Error(error.message);

    return { summary: text };
  });
