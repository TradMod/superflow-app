import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  Category,
  Goal,
  GoalDailyLog,
  GoalMilestone,
  Occurrence,
  OverrideWithTasks,
  PeriodKind,
  Subtask,
  SubtaskLog,
  Task,
} from "./dayflow";



export const categoriesQuery = () =>
  queryOptions({
    queryKey: ["categories"],
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase.from("categories").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

export const tasksQuery = () =>
  queryOptions({
    queryKey: ["tasks"],
    queryFn: async (): Promise<Task[]> => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("archived", false)
        .order("start_time", { nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

export const occurrencesQuery = (from: string, to: string) =>
  queryOptions({
    queryKey: ["occurrences", from, to],
    queryFn: async (): Promise<Occurrence[]> => {
      const { data, error } = await supabase
        .from("task_occurrences")
        .select("*")
        .gte("occurrence_date", from)
        .lte("occurrence_date", to);
      if (error) throw error;
      return data ?? [];
    },
  });

export const goalDailyLogsQuery = () =>
  queryOptions({
    queryKey: ["goal_daily_logs"],
    queryFn: async (): Promise<GoalDailyLog[]> => {
      const { data, error } = await supabase
        .from("goal_daily_logs")
        .select("*")
        .order("log_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });


export const profileQuery = () =>
  queryOptions({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const dayReviewQuery = (dateKey: string) =>
  queryOptions({
    queryKey: ["day_review", dateKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("day_reviews")
        .select("*")
        .eq("review_date", dateKey)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const overridesQuery = () =>
  queryOptions({
    queryKey: ["overrides"],
    queryFn: async (): Promise<OverrideWithTasks[]> => {
      const [{ data: rows, error }, { data: links, error: linkError }] = await Promise.all([
        supabase.from("schedule_overrides").select("*").order("start_date"),
        supabase.from("schedule_override_tasks").select("*"),
      ]);
      if (error) throw error;
      if (linkError) throw linkError;
      return (rows ?? []).map((row) => ({
        ...row,
        task_ids: (links ?? []).filter((l) => l.override_id === row.id).map((l) => l.task_id),
      }));
    },
  });

export const goalsQuery = () =>
  queryOptions({
    queryKey: ["goals"],
    queryFn: async (): Promise<Goal[]> => {
      const { data, error } = await supabase.from("goals").select("*").order("target_date");
      if (error) throw error;
      return data ?? [];
    },
  });

export const goalMilestonesQuery = () =>
  queryOptions({
    queryKey: ["goal_milestones"],
    queryFn: async (): Promise<GoalMilestone[]> => {
      const { data, error } = await supabase.from("goal_milestones").select("*").order("position");
      if (error) throw error;
      return data ?? [];
    },
  });

export const periodReviewQuery = (period: PeriodKind, periodStart: string) =>
  queryOptions({
    queryKey: ["period_review", period, periodStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("period_reviews")
        .select("*")
        .eq("period", period)
        .eq("period_start", periodStart)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Not signed in");
  return data.user.id;
}

