import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, Bell, CheckCircle2, Repeat, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Flow  Plan your day, track habits, review with AI" },
      {
        name: "description",
        content:
          "Flow keeps your routines, schedules and reminders in one place, tracks effort and time on every task, and writes you an end-of-day review with tomorrow's plan.",
      },
      { property: "og:title", content: "Flow  Plan your day, track habits, review with AI" },
      {
        property: "og:description",
        content:
          "Flow keeps your routines, schedules and reminders in one place, tracks effort and time on every task, and writes you an end-of-day review with tomorrow's plan.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: Repeat,
    title: "Routines that repeat",
    body: "Daily, weekday, weekly or monthly schedules that lay themselves out on every future date.",
  },
  {
    icon: CheckCircle2,
    title: "Effort, not just checkmarks",
    body: "Tick a task off with an effort rating and the minutes it actually took.",
  },
  {
    icon: Bell,
    title: "Reminders for later",
    body: "Park anything on a future date and see it surface the moment it's due.",
  },
  {
    icon: Sparkles,
    title: "An AI end-of-day review",
    body: "What went well, what slipped, and exactly what's on the table tomorrow.",
  },
  {
    icon: BarChart3,
    title: "Patterns over time",
    body: "Streaks, completion rates and where your hours actually go each week.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <span className="font-display text-2xl">DayFlow</span>
        <Button asChild variant="ghost">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <section className="mx-auto max-w-5xl px-6 pb-16 pt-10 md:pt-20">
        <p className="mb-4 inline-flex rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-widest text-secondary-foreground">
          Habit tracker · schedule · daily assistant
        </p>
        <h1 className="max-w-3xl font-display text-5xl leading-[1.05] md:text-7xl">
          Keep track of your whole day, then let it tell you how it went.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Add your routines and schedules once, check them off with effort and time as the day goes,
          and get an honest review each evening — plus a preview of tomorrow.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/auth">
              Start your first day <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-6 pb-24 md:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-2xl border border-border bg-card p-6">
            <Icon className="mb-4 h-5 w-5 text-primary" />
            <h2 className="text-lg">{title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
