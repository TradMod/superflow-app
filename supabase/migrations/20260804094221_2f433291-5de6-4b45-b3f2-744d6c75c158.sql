-- 1. Remove reminders entirely
DROP TABLE IF EXISTS public.reminders CASCADE;

-- 2. goal_period: add 'daily'
CREATE TYPE public.goal_period_new AS ENUM ('daily','weekly','monthly','yearly');
ALTER TABLE public.goals ALTER COLUMN period DROP DEFAULT;
ALTER TABLE public.goals ALTER COLUMN period TYPE public.goal_period_new USING period::text::public.goal_period_new;
DROP TYPE public.goal_period;
ALTER TYPE public.goal_period_new RENAME TO goal_period;
ALTER TABLE public.goals ALTER COLUMN period SET DEFAULT 'monthly'::public.goal_period;

-- 3. goal_tracking: add 'both'
CREATE TYPE public.goal_tracking_new AS ENUM ('numeric','checklist','both');
ALTER TABLE public.goals ALTER COLUMN tracking DROP DEFAULT;
ALTER TABLE public.goals ALTER COLUMN tracking TYPE public.goal_tracking_new USING tracking::text::public.goal_tracking_new;
DROP TYPE public.goal_tracking;
ALTER TYPE public.goal_tracking_new RENAME TO goal_tracking;
ALTER TABLE public.goals ALTER COLUMN tracking SET DEFAULT 'numeric'::public.goal_tracking;

-- 4. Daily goal logs (daily goals reset each day)
CREATE TABLE public.goal_daily_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id uuid NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (goal_id, log_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.goal_daily_logs TO authenticated;
GRANT ALL ON public.goal_daily_logs TO service_role;

ALTER TABLE public.goal_daily_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY goal_daily_logs_own ON public.goal_daily_logs
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER goal_daily_logs_updated
  BEFORE UPDATE ON public.goal_daily_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX goal_daily_logs_goal_date_idx ON public.goal_daily_logs (goal_id, log_date DESC);