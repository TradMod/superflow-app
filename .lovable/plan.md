# DayFlow — habit tracker, schedule maker, and daily assistant

A private, login-protected app for planning your day, checking off tasks with effort and time spent, and getting an end-of-day analysis plus a preview of tomorrow.

## Core screens

**Today (home after sign-in)**
- Timeline of today's tasks: routines, one-off tasks, and scheduled blocks with times.
- Each item has a checkbox. Checking it opens a quick capture: effort (1-5) + minutes spent, optional note.
- Live progress ring: completed vs planned, total time logged, current streaks.
- "Due now / overdue" reminder strip at the top.

**Plan**
- Add task/schedule item: title, category, date, optional start-end time, priority, notes.
- Repeat options: none, daily, weekdays, weekly (pick days), monthly (pick day-of-month), with optional end date. Repeating items generate occurrences on the calendar automatically.
- Habits: recurring items tracked for streaks.

**Calendar**
- Month and week views showing planned vs completed density, click a day to see or edit its items.
- Add reminders tied to any future date/time.

**Reminders**
- List of upcoming reminders grouped by today / this week / later, with in-app badges and a due indicator on the Today page. No email or push.

**Day review (end of day)**
- Stats: completion rate, time spent per category, average effort, habit streaks, best/worst time blocks, 7-day trend charts.
- AI summary written on top of those stats: what went well, what slipped, patterns, and 2-3 concrete suggestions for tomorrow.
- "On the table tomorrow": tomorrow's generated occurrences, reminders, and anything you missed today offered for rollover.

**Insights**
- Weekly/monthly charts: consistency per habit, effort vs time, category balance.

## Accounts

Email/password sign-up and sign-in plus Google sign-in, with a profile (display name, timezone, preferred day-review time). All data private per user.

## Technical notes

- Lovable Cloud for auth, database, and server logic.
- Tables (all with row-level security scoped to the signed-in user): `profiles`, `categories`, `tasks` (holds recurrence rule, time window, priority, habit flag), `task_occurrences` (one row per concrete date, with `status`, `effort` 1-5, `minutes_spent`, `note`), `reminders`, `day_reviews` (date, computed stats JSON, AI summary text).
- Recurrence expanded server-side into `task_occurrences` for a rolling window (e.g. next 60 days), regenerated when a task's rule changes.
- Reads via TanStack Query with route loaders; writes via authenticated server functions with zod validation.
- AI day summary generated through the Lovable AI Gateway (Gemini Flash) from the computed day stats, cached in `day_reviews` so it is generated once per day and regenerable on demand.
- Charts with Recharts; date handling with date-fns.
- Distinct routes: `/` landing with sign-in CTA, `/auth`, and protected `/today`, `/plan`, `/calendar`, `/reminders`, `/review`, `/insights`, `/settings`.

## Design direction

Calm, focused productivity aesthetic: warm off-white light mode with a deep ink dark mode, one confident accent color, generous spacing, large tap targets for mobile-first use, subtle motion when checking off a task. Mobile layout gets a bottom tab bar; desktop gets a sidebar.

## Build order

1. Cloud setup: auth, schema, RLS, profile trigger.
2. Auth flow, app shell, navigation, design system.
3. Tasks and schedules with recurrence + occurrence generation.
4. Today view with check-off, effort, and time capture.
5. Reminders and calendar.
6. Day review: stats + AI summary + tomorrow preview.
7. Insights charts and settings polish.
