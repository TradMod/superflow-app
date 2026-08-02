-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  review_time TIME NOT NULL DEFAULT '21:00',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_own" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- categories
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'sky',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_own" ON public.categories FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX categories_user_idx ON public.categories(user_id);

-- tasks
CREATE TYPE public.repeat_kind AS ENUM ('none','daily','weekdays','weekly','monthly');

CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  notes TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  priority SMALLINT NOT NULL DEFAULT 2,
  start_time TIME,
  end_time TIME,
  is_habit BOOLEAN NOT NULL DEFAULT false,
  repeat_kind public.repeat_kind NOT NULL DEFAULT 'none',
  repeat_days SMALLINT[] NOT NULL DEFAULT '{}',
  repeat_day_of_month SMALLINT,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks_own" ON public.tasks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX tasks_user_idx ON public.tasks(user_id);

-- occurrences
CREATE TYPE public.occurrence_status AS ENUM ('pending','done','skipped');

CREATE TABLE public.task_occurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  occurrence_date DATE NOT NULL,
  status public.occurrence_status NOT NULL DEFAULT 'pending',
  effort SMALLINT,
  minutes_spent INTEGER,
  note TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (task_id, occurrence_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_occurrences TO authenticated;
GRANT ALL ON public.task_occurrences TO service_role;
ALTER TABLE public.task_occurrences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "occ_own" ON public.task_occurrences FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX occ_user_date_idx ON public.task_occurrences(user_id, occurrence_date);

-- reminders
CREATE TABLE public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  notes TEXT,
  due_date DATE NOT NULL,
  due_time TIME,
  done BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminders TO authenticated;
GRANT ALL ON public.reminders TO service_role;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reminders_own" ON public.reminders FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX reminders_user_due_idx ON public.reminders(user_id, due_date);

-- day reviews
CREATE TABLE public.day_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  review_date DATE NOT NULL,
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, review_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.day_reviews TO authenticated;
GRANT ALL ON public.day_reviews TO service_role;
ALTER TABLE public.day_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_own" ON public.day_reviews FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tasks_updated BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER occ_updated BEFORE UPDATE ON public.task_occurrences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER reminders_updated BEFORE UPDATE ON public.reminders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER reviews_updated BEFORE UPDATE ON public.day_reviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- new user bootstrap
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.categories (user_id, name, color) VALUES
    (NEW.id, 'Health', 'emerald'),
    (NEW.id, 'Work', 'sky'),
    (NEW.id, 'Personal', 'amber'),
    (NEW.id, 'Learning', 'violet');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();