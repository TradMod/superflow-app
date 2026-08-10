import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, CalendarOff, CheckCircle2, Repeat, Sparkles, Target } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SuperFlow — Plan your day, track habits, review with AI" },
      {
        name: "description",
        content:
          "SuperFlow keeps your routines, events and goals in one place, tracks effort and time on every task, and writes you a daily, weekly or monthly review.",
      },
      { property: "og:title", content: "SuperFlow — Plan your day, track habits, review with AI" },
      {
        property: "og:description",
        content:
          "SuperFlow keeps your routines, events and goals in one place, tracks effort and time on every task, and writes you a daily, weekly or monthly review.",
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
    icon: CalendarOff,
    title: "Events that excuse your day",
    body: "Off at a hackathon? Block the days and your streaks stay intact instead of breaking.",
  },
  {
    icon: Target,
    title: "Goals with real tracking",
    body: "Daily, weekly, monthly or yearly goals tracked by a number, milestones, or both.",
  },
  {
    icon: Sparkles,
    title: "AI day, week and month reviews",
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
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <span className="flex items-center gap-2.5">
          <span className="h-8 w-8 rounded-2xl bg-linear-to-br from-primary to-primary-glow shadow-soft" />
          <span className="font-display text-xl font-semibold tracking-tight">SuperFlow</span>
        </span>
        <Button asChild variant="ghost">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <section className="mx-auto max-w-5xl px-6 pb-16 pt-10 md:pt-24">
        <p className="glass mb-6 inline-flex rounded-full px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Habit tracker · schedule · daily assistant
        </p>
        <h1 className="text-gradient max-w-3xl font-display text-4xl leading-[1.06] md:text-6xl">
          Keep track of your whole day, then let it tell you how it went.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
          Add your routines and schedules once, check them off with effort and time as the day goes,
          and get an honest review each evening — plus a preview of tomorrow.
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Button asChild size="lg" className="rounded-full px-6 shadow-lift">
            <Link to="/auth">
              Start your first day <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-6 pb-24 md:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="panel sheen p-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift"
          >
            <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-primary">
              <Icon className="h-5 w-5" />
            </span>
            <h2 className="text-base font-semibold">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
