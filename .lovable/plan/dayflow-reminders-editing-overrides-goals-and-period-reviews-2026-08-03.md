# DayFlow — reminders editing, overrides, goals, and period reviews

Five additions to the existing app, none of which change how daily habit tracking already works.

## 1. Edit reminders

Each reminder gets an edit action next to delete. It opens the same dialog used for creating one, pre-filled with title, notes, date and time, and saves in place. Creating and editing share one dialog component.

## 2. Reminders in "On the table tomorrow"

The review page's tomorrow section lists tomorrow's tasks *and* tomorrow's open reminders, visually separated ("Reminders" vs "Tasks"), and the reminder titles are passed to the AI so the summary can mention them.

## 3. Daily / weekly / monthly AI reviews

The Review tab gets a Day / Week / Month switcher.

- **Day** — current behaviour, unchanged.
- **Week** — current week (Mon–Sun): completion rate per day, total minutes, time by category, habit consistency (days done / days scheduled), best and worst day.
- **Month** — same shape over the calendar month, plus a per-week trend and the top and bottom habits.

Each period generates its own AI summary with a prompt tuned to that horizon (a weekly review talks about patterns and consistency, a monthly one about trends and drift). Summaries are cached per period so they are generated once and can be regenerated on demand.

## 4. Schedule overrides (events)

A new kind of entry: an **event** such as "Hackathon", defined either as full days (start date → end date) or as a time window on a date. When creating it you pick which habits/tasks it excuses; by default all of them.

Effects on an overridden day:

- Excused tasks disappear from Today and from that day's planned/completed counts.
- Streaks skip the excused day rather than breaking — a habit done Mon and Thu with Tue–Wed excused is a 4-day streak.
- The calendar shows the event as a band across the affected days.
- The event itself appears on Today as a block with its own time window, and can be checked off with effort and minutes like anything else.
- Day/week/month reviews mention the event and count excused days separately from missed ones.

## 5. Goals tab

New "Goals" tab in the sidebar and bottom bar, fully separate from tasks, habits and reminders.

- Create a goal with a title, optional notes, a category, and a period: **weekly**, **monthly**, or **yearly**, with a target date.
- Progress is tracked per goal in one of two ways, chosen at creation:
  - **Numeric target** — e.g. "read 30 books", update the current number as you go.
  - **Milestone checklist** — add sub-steps and tick them off; progress is ticked / total.
- Goals list grouped by period, each with a progress bar, percentage, days remaining, and a status (on track / behind / done).
- Editing, archiving and deleting a goal. Completed goals move to a "Achieved" section.
- Goals never generate task occurrences and never affect habit stats or streaks.

## Technical notes

**Database (one migration):**

- `schedule_overrides` — user_id, title, notes, start_date, end_date, optional start_time/end_time, `excuse_all` flag, timestamps.
- `schedule_override_tasks` — override_id, task_id, for the "choose which" case.
- `goals` — user_id, title, notes, category_id, period enum (weekly/monthly/yearly), start_date, target_date, tracking enum (numeric/checklist), target_value, current_value, status, timestamps.
- `goal_milestones` — goal_id, title, done, position.
- `period_reviews` (or extend `day_reviews`) — user_id, period enum (day/week/month), period_start, stats JSON, summary text, unique on (user_id, period, period_start).

All new tables follow the existing pattern: GRANTs to `authenticated` and `service_role`, RLS enabled, owner-only policies on `auth.uid()`, and an `updated_at` trigger.

**Logic (`src/lib/dayflow.ts`):**

- `isExcused(task, dateKey, overrides)` — used by `buildDay` to drop excused items and by `computeStreak` to skip rather than break.
- `computeWeekStats` / `computeMonthStats` built from the existing per-day stats.

**Server (`src/lib/review.functions.ts`):** `generateDaySummary` generalised to `generatePeriodSummary` taking a period plus its stats, with three prompt variants; still upserted and cached.

**UI:** new `src/routes/_authenticated/goals.tsx`, an override dialog on the Plan page, an edit dialog on Reminders, period switcher on Review, event bands on Calendar, and a Goals entry in `AppShell` navigation.
