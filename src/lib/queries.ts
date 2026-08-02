import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Category, Occurrence, Reminder, Task } from "./dayflow";

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

export const remindersQuery = () =>
  queryOptions({
    queryKey: ["reminders"],
    queryFn: async (): Promise<Reminder[]> => {
      const { data, error } = await supabase
        .from("reminders")
        .select("*")
        .order("due_date")
        .order("due_time", { nullsFirst: true });
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

export async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Not signed in");
  return data.user.id;
}
