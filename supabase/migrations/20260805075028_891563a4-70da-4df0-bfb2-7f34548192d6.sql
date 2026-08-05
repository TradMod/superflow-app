CREATE TABLE public.task_subtasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  recurring boolean NOT NULL DEFAULT false,
  for_date date,
  position smallint NOT NULL DEFAULT 0,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_subtasks TO authenticated;
GRANT ALL ON public.task_subtasks TO service_role;
ALTER TABLE public.task_subtasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY task_subtasks_own ON public.task_subtasks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER task_subtasks_updated BEFORE UPDATE ON public.task_subtasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX task_subtasks_task_idx ON public.task_subtasks(task_id);

CREATE TABLE public.task_subtask_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subtask_id uuid NOT NULL REFERENCES public.task_subtasks(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subtask_id, log_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_subtask_logs TO authenticated;
GRANT ALL ON public.task_subtask_logs TO service_role;
ALTER TABLE public.task_subtask_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY task_subtask_logs_own ON public.task_subtask_logs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER task_subtask_logs_updated BEFORE UPDATE ON public.task_subtask_logs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX task_subtask_logs_date_idx ON public.task_subtask_logs(user_id, log_date);

ALTER TABLE public.goals ADD COLUMN parent_id uuid REFERENCES public.goals(id) ON DELETE SET NULL;
CREATE INDEX goals_parent_idx ON public.goals(parent_id);