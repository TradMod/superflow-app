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
  tomorrowReminders: z.array(z.string()),
  streaks: z.array(z.object({ title: z.string(), days: z.number() })),
});

type Stats = z.infer<typeof StatsInput>;

const SYSTEM: Record<Stats["period"], string> = {
  day: "You are a warm, direct personal productivity coach. Given one day of task data, write a short review in plain text (no markdown) with three labelled parts: 'What went well', 'What slipped', and 'Tomorrow'. Keep the whole thing under 160 words, use second person, be specific about the actual task names and numbers given, and end with 2-3 concrete suggestions for tomorrow. No greetings, no fluff.",
  week: "You are a warm, direct personal productivity coach. Given one week of task data, write a weekly review in plain text (no markdown) with three labelled parts: 'Patterns', 'Consistency', and 'Next week'. Focus on patterns across days and habit consistency rather than individual tasks. Keep it under 200 words, use second person, cite real numbers and habit names, and end with 2-3 concrete adjustments for next week. No greetings, no fluff.",
  month: "You are a warm, direct personal productivity coach. Given one month of task data, write a monthly review in plain text (no markdown) with three labelled parts: 'Trend', 'Drift', and 'Next month'. Focus on how the month trended week over week, which habits held and which drifted, and where time actually went. Keep it under 220 words, use second person, cite real numbers, and end with 2-3 concrete changes for next month. No greetings, no fluff.",
};

function buildPrompt(data: Stats): string {
  const lines = [
    `Period: ${data.period} (${data.label})`,
    `Planned tasks: ${data.planned}, completed: ${data.done}, skipped: ${data.skipped} (${data.completionRate}% completion)`,
    `Total time logged: ${data.minutes} minutes. Average effort (1-5): ${data.avgEffort ?? "not recorded"}`,
    `Time by category: ${data.byCategory.map((c) => `${c.name} ${c.minutes}m (${c.done} tasks)`).join(", ") || "none"}`,
    `Habit consistency: ${data.habits.map((h) => `${h.title} ${h.done}/${h.scheduled} days (${h.rate}%)`).join(", ") || "none"}`,
    `Live habit streaks: ${data.streaks.map((s) => `${s.title} ${s.days}d`).join(", ") || "none"}`,
    `Days excused by events: ${data.excusedDays}${data.events.length ? ` (${data.events.join(", ")}) — these were deliberately taken off, do not treat them as failures` : ""}`,
  ];

  if (data.period === "day") {
    lines.push(
      `Completed: ${data.completed.join(", ") || "nothing"}`,
      `Not completed: ${data.missed.join(", ") || "nothing"}`,
      `On the table tomorrow — tasks: ${data.tomorrowTasks.join(", ") || "nothing scheduled yet"}`,
      `On the table tomorrow — reminders: ${data.tomorrowReminders.join(", ") || "none"}`,
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
