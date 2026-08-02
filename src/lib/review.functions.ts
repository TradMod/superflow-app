import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const StatsInput = z.object({
  dateKey: z.string().min(8),
  planned: z.number(),
  done: z.number(),
  skipped: z.number(),
  completionRate: z.number(),
  minutes: z.number(),
  avgEffort: z.number().nullable(),
  byCategory: z.array(z.object({ name: z.string(), minutes: z.number(), done: z.number() })),
  completed: z.array(z.string()).max(60),
  missed: z.array(z.string()).max(60),
  tomorrow: z.array(z.string()).max(60),
  streaks: z.array(z.object({ title: z.string(), days: z.number() })).max(30),
});

export const generateDaySummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StatsInput.parse(input))
  .handler(async ({ data, context }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured for this app yet.");

    const gateway = createLovableAiGatewayProvider(key);

    const prompt = [
      `Date: ${data.dateKey}`,
      `Planned tasks: ${data.planned}, completed: ${data.done}, skipped: ${data.skipped} (${data.completionRate}% completion)`,
      `Total time logged: ${data.minutes} minutes. Average effort (1-5): ${data.avgEffort ?? "not recorded"}`,
      `Time by category: ${data.byCategory.map((c) => `${c.name} ${c.minutes}m (${c.done} tasks)`).join(", ") || "none"}`,
      `Completed: ${data.completed.join(", ") || "nothing"}`,
      `Not completed: ${data.missed.join(", ") || "nothing"}`,
      `Live habit streaks: ${data.streaks.map((s) => `${s.title} ${s.days}d`).join(", ") || "none"}`,
      `On the table tomorrow: ${data.tomorrow.join(", ") || "nothing scheduled yet"}`,
    ].join("\n");

    let text: string;
    try {
      const result = await generateText({
        model: gateway("google/gemini-3.5-flash"),
        system:
          "You are a warm, direct personal productivity coach. Given one day of task data, write a short review in markdown-free plain text with three labelled parts: 'What went well', 'What slipped', and 'Tomorrow'. Keep the whole thing under 160 words, use second person, be specific about the actual task names and numbers given, and end with 2-3 concrete suggestions for tomorrow. No greetings, no fluff.",
        prompt,
      });
      text = result.text.trim();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("429")) throw new Error("AI is busy right now — try again in a moment.");
      if (message.includes("402")) throw new Error("AI credits are exhausted for this workspace.");
      throw new Error("Could not generate your day review.");
    }

    const { error } = await context.supabase.from("day_reviews").upsert(
      {
        user_id: context.userId,
        review_date: data.dateKey,
        stats: JSON.parse(JSON.stringify(data)),
        summary: text,
      },
      { onConflict: "user_id,review_date" },
    );
    if (error) throw new Error(error.message);

    return { summary: text };
  });
