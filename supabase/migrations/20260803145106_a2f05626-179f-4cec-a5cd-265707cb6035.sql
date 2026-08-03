-- Enums
CREATE TYPE public.goal_period AS ENUM ('weekly', 'monthly', 'yearly');
CREATE TYPE public.goal_tracking AS ENUM ('numeric', 'checklist');
CREATE TYPE public.goal_status AS ENUM ('active', 'achieved', 'archived');
CREATE TYPE public.review_period AS ENUM ('day', 'week', 'month');

-- Schedule overrides (events)
CREATE TABLE public.schedule_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  notes text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  start_time time,
  end_time time,
  excuse_all boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_overrides TO authenticated;
GRANT ALL ON public.schedule_overrides TO service_role;
ALTER TABLE public.schedule_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY overrides_own ON public.schedule_overrides FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER overrides_updated BEFORE UPDATE ON public.schedule_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX schedule_overrides_user_dates_idx ON public.schedule_overrides (user_id, start_date, end_date);

CREATE TABLE public.schedule_override_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  override_id uuid NOT NULL REFERENCES public.schedule_overrides(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (override_id, task_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_override_tasks TO authenticated;
GRANT ALL ON public.schedule_override_tasks TO service_role;
ALTER TABLE public.schedule_override_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY override_tasks_own ON public.schedule_override_tasks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.schedule_overrides o WHERE o.id = override_id AND o.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.schedule_overrides o WHERE o.id = override_id AND o.user_id = auth.uid()));

-- Goals
CREATE TABLE public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  notes text,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  period public.goal_period NOT NULL DEFAULT 'monthly',
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  target_date date NOT NULL,
  tracking public.goal_tracking NOT NULL DEFAULT 'numeric',
  target_value numeric NOT NULL DEFAULT 1,
  current_value numeric NOT NULL DEFAULT 0,
  unit text,
  status public.goal_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY goals_own ON public.goals FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER goals_updated BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.goal_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  title text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  position smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goal_milestones TO authenticated;
GRANT ALL ON public.goal_milestones TO service_role;
ALTER TABLE public.goal_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY goal_milestones_own ON public.goal_milestones FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.user_id = auth.uid()));

-- Period reviews (day / week / month)
CREATE TABLE public.period_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period public.review_period NOT NULL,
  period_start date NOT NULL,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, period, period_start)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.period_reviews TO authenticated;
GRANT ALL ON public.period_reviews TO service_role;
ALTER TABLE public.period_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY period_reviews_own ON public.period_reviews FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER period_reviews_updated BEFORE UPDATE ON public.period_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();