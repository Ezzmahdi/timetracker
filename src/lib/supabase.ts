import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types
export interface Profile {
  id: string;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface TimeEntry {
  id: string;
  user_id: string;
  activity_id: string;
  period_key: string;
  period_type: "day" | "week";
  hours: number;
  created_at: string;
  updated_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  activity_id: string;
  target_hours: number;
  period_type: "day" | "week";
  created_at: string;
  updated_at: string;
}

export interface AnalyticsSummary {
  user_id: string;
  period_key: string;
  period_type: "day" | "week";
  activity_name: string;
  activity_color: string;
  hours: number;
  percentage: number;
}

export interface PeriodTotal {
  user_id: string;
  period_key: string;
  period_type: "day" | "week";
  total_hours: number;
  remaining_hours: number;
}

// Helper functions for database operations
export async function getActivities(userId: string) {
  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data as Activity[];
}

export async function createActivity(
  userId: string,
  name: string,
  color: string
) {
  const { data, error } = await supabase
    .from("activities")
    .insert({ user_id: userId, name, color })
    .select()
    .single();

  if (error) throw error;
  return data as Activity;
}

export async function updateActivity(
  activityId: string,
  updates: Partial<Pick<Activity, "name" | "color">>
) {
  const { data, error } = await supabase
    .from("activities")
    .update(updates)
    .eq("id", activityId)
    .select()
    .single();

  if (error) throw error;
  return data as Activity;
}

export async function deleteActivity(activityId: string) {
  const { error } = await supabase
    .from("activities")
    .delete()
    .eq("id", activityId);

  if (error) throw error;
}

export async function getTimeEntries(
  userId: string,
  periodKey?: string,
  periodType?: "day" | "week"
) {
  let query = supabase
    .from("time_entries")
    .select("*, activities(*)")
    .eq("user_id", userId);

  if (periodKey) query = query.eq("period_key", periodKey);
  if (periodType) query = query.eq("period_type", periodType);

  const { data, error } = await query.order("created_at", { ascending: true });

  if (error) throw error;
  return data;
}

export async function upsertTimeEntry(
  userId: string,
  activityId: string,
  periodKey: string,
  periodType: "day" | "week",
  hours: number
) {
  const { data, error } = await supabase
    .from("time_entries")
    .upsert(
      {
        user_id: userId,
        activity_id: activityId,
        period_key: periodKey,
        period_type: periodType,
        hours,
      },
      { onConflict: "activity_id,period_key,period_type" }
    )
    .select()
    .single();

  if (error) throw error;
  return data as TimeEntry;
}

export async function deleteTimeEntry(timeEntryId: string) {
  const { error } = await supabase
    .from("time_entries")
    .delete()
    .eq("id", timeEntryId);

  if (error) throw error;
}

// Analytics queries
export async function getAnalyticsSummary(
  userId: string,
  startDate?: string,
  endDate?: string
) {
  let query = supabase
    .from("analytics_summary")
    .select("*")
    .eq("user_id", userId);

  if (startDate) query = query.gte("period_key", startDate);
  if (endDate) query = query.lte("period_key", endDate);

  const { data, error } = await query.order("period_key", { ascending: true });

  if (error) throw error;
  return data as AnalyticsSummary[];
}

export async function getPeriodTotals(
  userId: string,
  startDate?: string,
  endDate?: string
) {
  let query = supabase.from("period_totals").select("*").eq("user_id", userId);

  if (startDate) query = query.gte("period_key", startDate);
  if (endDate) query = query.lte("period_key", endDate);

  const { data, error } = await query.order("period_key", { ascending: true });

  if (error) throw error;
  return data as PeriodTotal[];
}

// Get all time entries with activity details for analytics
export async function getAnalyticsData(
  userId: string,
  startDate?: string,
  endDate?: string
) {
  let query = supabase
    .from("time_entries")
    .select(
      `
      *,
      activities (
        id,
        name,
        color
      )
    `
    )
    .eq("user_id", userId);

  if (startDate) query = query.gte("period_key", startDate);
  if (endDate) query = query.lte("period_key", endDate);

  const { data, error } = await query.order("period_key", { ascending: true });

  if (error) throw error;
  return data;
}
