import { create } from "zustand";
import { supabase } from "@/lib/supabase";

export interface Tube {
  id: string;
  name: string;
  hours: number;
  color: string;
  activity_id?: string; // DB activity ID
  time_entry_id?: string; // DB time entry ID
}

export interface Goal {
  id?: string; // DB goal ID
  activity_id: string;
  target_hours: number;
  period_type: ViewMode;
}

export type ViewMode = "week" | "day";

interface PeriodData {
  tubes: Tube[];
}

interface TimeStore {
  mode: ViewMode;
  currentDate: string; // ISO date string YYYY-MM-DD
  periods: Record<string, PeriodData>; // key = period key
  goals: Goal[]; // all goals for current user
  userId: string | null;
  loading: boolean;
  initialized: boolean;

  setUserId: (userId: string | null) => void;
  setMode: (mode: ViewMode) => void;
  goToday: () => void;
  navigate: (delta: number) => void;
  addTube: (name: string) => Promise<void> | void;
  removeTube: (id: string) => Promise<void> | void;
  renameTube: (id: string, name: string) => Promise<void> | void;
  setHours: (id: string, hours: number) => Promise<void> | void;
  addHours: (id: string, hours: number) => Promise<void> | void;
  removeHours: (id: string, hours: number) => Promise<void> | void;
  resetPeriod: () => Promise<void> | void;
  setGoal: (activityId: string, targetHours: number, periodType: ViewMode) => Promise<void> | void;
  removeGoal: (activityId: string, periodType: ViewMode) => Promise<void> | void;
  getGoal: (activityId: string, periodType: ViewMode) => Goal | undefined;
  loadFromDb: () => Promise<void>;
  syncToDb: () => Promise<void>;
}

const COLORS = [
  "#6366f1", // indigo
  "#f43f5e", // rose
  "#0ea5e9", // sky
  "#f97316", // orange
  "#10b981", // emerald
  "#ec4899", // pink
  "#8b5cf6", // violet
  "#eab308", // yellow
  "#14b8a6", // teal
  "#3b82f6", // blue
];

let colorIdx = 0;
function nextColor() {
  const c = COLORS[colorIdx % COLORS.length];
  colorIdx++;
  return c;
}

// --- Date helpers ---

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const m = new Date(d);
  m.setDate(diff);
  m.setHours(0, 0, 0, 0);
  return m;
}

export function periodKey(date: string, mode: ViewMode): string {
  if (mode === "day") return date;
  const d = new Date(date + "T00:00:00");
  const mon = getMonday(d);
  return mon.toISOString().slice(0, 10); // Monday of that week
}

export function maxHours(mode: ViewMode): number {
  return mode === "week" ? 168 : 24;
}

export function periodLabel(date: string, mode: ViewMode): string {
  const d = new Date(date + "T00:00:00");
  if (mode === "day") {
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  const mon = getMonday(d);
  const sun = new Date(mon);
  sun.setDate(sun.getDate() + 6);
  const fmt = (dt: Date) =>
    dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(mon)} – ${fmt(sun)}, ${sun.getFullYear()}`;
}

export function isCurrentPeriod(date: string, mode: ViewMode): boolean {
  const today = todayStr();
  return periodKey(date, mode) === periodKey(today, mode);
}

function addDays(date: string, n: number): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// --- Debounced DB write for hours ---
const hoursTimers: Record<string, ReturnType<typeof setTimeout>> = {};
function debouncedHoursSync(entryId: string, hours: number, delay = 500) {
  if (hoursTimers[entryId]) clearTimeout(hoursTimers[entryId]);
  hoursTimers[entryId] = setTimeout(async () => {
    try {
      await supabase.from("time_entries").update({ hours }).eq("id", entryId);
    } catch (err) {
      console.error("Failed to sync hours to DB:", err);
    }
    delete hoursTimers[entryId];
  }, delay);
}

// --- Store ---

export const useTimeStore = create<TimeStore>((set, get) => ({
  mode: "week",
  currentDate: todayStr(),
  periods: {},
  goals: [],
  userId: null,
  loading: false,
  initialized: false,

  setUserId: (userId) => {
    set({ userId });
    if (userId) {
      get().loadFromDb();
    }
  },

  setMode: (mode) => set({ mode }),

  goToday: () => set({ currentDate: todayStr() }),

  navigate: (delta) => {
    const { mode, currentDate } = get();
    const days = mode === "week" ? delta * 7 : delta;
    set({ currentDate: addDays(currentDate, days) });
  },

  addTube: async (name) => {
    const { mode, currentDate, periods, userId } = get();
    const key = periodKey(currentDate, mode);
    const pd = periods[key] || { tubes: [] };
    const id = crypto.randomUUID();
    const color = nextColor();
    
    // Optimistic update
    set({
      periods: {
        ...periods,
        [key]: { tubes: [...pd.tubes, { id, name, hours: 0, color }] },
      },
    });

    // Sync to DB if user is logged in
    if (userId) {
      try {
        // Create activity
        const { data: activity, error: actError } = await supabase
          .from("activities")
          .insert({ user_id: userId, name, color })
          .select()
          .single();
        
        if (actError) throw actError;

        // Create time entry with 0 hours
        const { data: entry, error: entryError } = await supabase
          .from("time_entries")
          .insert({
            user_id: userId,
            activity_id: activity.id,
            period_key: key,
            period_type: mode,
            hours: 0,
          })
          .select()
          .single();

        if (entryError) throw entryError;

        // Update local state with DB IDs
        const updatedPeriods = get().periods;
        const updatedPd = updatedPeriods[key];
        if (updatedPd) {
          set({
            periods: {
              ...updatedPeriods,
              [key]: {
                tubes: updatedPd.tubes.map((t) =>
                  t.id === id
                    ? { ...t, activity_id: activity.id, time_entry_id: entry.id }
                    : t
                ),
              },
            },
          });
        }
      } catch (err) {
        console.error("Failed to sync addTube to DB:", err);
      }
    }
  },

  removeTube: async (id) => {
    const { mode, currentDate, periods, userId } = get();
    const key = periodKey(currentDate, mode);
    const pd = periods[key];
    if (!pd) return;

    const tube = pd.tubes.find((t) => t.id === id);
    
    // Optimistic update
    set({
      periods: {
        ...periods,
        [key]: { tubes: pd.tubes.filter((t) => t.id !== id) },
      },
    });

    // Sync to DB
    if (userId && tube?.activity_id) {
      try {
        // Delete time entry first (foreign key)
        if (tube.time_entry_id) {
          await supabase.from("time_entries").delete().eq("id", tube.time_entry_id);
        }
        // Delete activity
        await supabase.from("activities").delete().eq("id", tube.activity_id);
      } catch (err) {
        console.error("Failed to sync removeTube to DB:", err);
      }
    }
  },

  renameTube: async (id, name) => {
    const { mode, currentDate, periods, userId } = get();
    const key = periodKey(currentDate, mode);
    const pd = periods[key];
    if (!pd) return;

    const tube = pd.tubes.find((t) => t.id === id);
    
    // Optimistic update
    set({
      periods: {
        ...periods,
        [key]: { tubes: pd.tubes.map((t) => (t.id === id ? { ...t, name } : t)) },
      },
    });

    // Sync to DB
    if (userId && tube?.activity_id) {
      try {
        await supabase
          .from("activities")
          .update({ name })
          .eq("id", tube.activity_id);
      } catch (err) {
        console.error("Failed to sync renameTube to DB:", err);
      }
    }
  },

  setHours: async (id, hours) => {
    const { mode, currentDate, periods, userId } = get();
    const key = periodKey(currentDate, mode);
    const weekKey = periodKey(currentDate, "week");
    
    // In day mode, we work with week activities but store day-specific hours
    if (mode === "day") {
      const weekPd = periods[weekKey];
      const dayPd = periods[key] || { tubes: [] };
      const weekTube = weekPd?.tubes.find((t) => t.id === id);
      if (!weekTube) return;
      
      const max = maxHours(mode);
      const dayTubes = weekPd?.tubes.map(wt => {
        const dt = dayPd.tubes.find(d => d.activity_id === wt.activity_id);
        return dt || { ...wt, hours: 0 };
      }) || [];
      const otherUsed = dayTubes.reduce((s, t) => s + (t.id === id ? 0 : t.hours), 0);
      const clamped = Math.max(0, Math.min(hours, max - otherUsed));
      
      const dayEntry = dayPd.tubes.find((t) => t.activity_id === weekTube.activity_id);
      
      if (dayEntry) {
        set({
          periods: {
            ...periods,
            [key]: {
              tubes: dayPd.tubes.map((t) =>
                t.activity_id === weekTube.activity_id ? { ...t, hours: clamped } : t
              ),
            },
          },
        });
        
        if (userId && dayEntry.time_entry_id) {
          debouncedHoursSync(dayEntry.time_entry_id, clamped);
        }
      } else {
        const newId = crypto.randomUUID();
        const newTube = { ...weekTube, id: newId, hours: clamped, time_entry_id: undefined };
        
        set({
          periods: {
            ...periods,
            [key]: {
              tubes: [...dayPd.tubes, newTube],
            },
          },
        });
        
        if (userId && weekTube.activity_id) {
          try {
            const { data: entry, error } = await supabase
              .from("time_entries")
              .insert({
                user_id: userId,
                activity_id: weekTube.activity_id,
                period_key: key,
                period_type: "day",
                hours: clamped,
              })
              .select()
              .single();
            
            if (!error && entry) {
              const updatedPeriods = get().periods;
              const updatedDayPd = updatedPeriods[key];
              if (updatedDayPd) {
                set({
                  periods: {
                    ...updatedPeriods,
                    [key]: {
                      tubes: updatedDayPd.tubes.map((t) =>
                        t.id === newId ? { ...t, time_entry_id: entry.id } : t
                      ),
                    },
                  },
                });
              }
            }
          } catch (err) {
            console.error("Failed to create day entry in DB:", err);
          }
        }
      }
      return;
    }
    
    // Week mode
    const pd = periods[key];
    if (!pd) return;
    const max = maxHours(mode);
    const otherUsed = pd.tubes.reduce((s, t) => s + (t.id === id ? 0 : t.hours), 0);
    const clamped = Math.max(0, Math.min(hours, max - otherUsed));
    
    const tube = pd.tubes.find((t) => t.id === id);
    
    set({
      periods: {
        ...periods,
        [key]: {
          tubes: pd.tubes.map((t) =>
            t.id === id ? { ...t, hours: clamped } : t
          ),
        },
      },
    });

    if (userId && tube?.time_entry_id) {
      debouncedHoursSync(tube.time_entry_id, clamped);
    }
  },

  addHours: async (id, hours) => {
    const { mode, currentDate, periods } = get();
    const key = periodKey(currentDate, mode);
    const weekKey = periodKey(currentDate, "week");
    
    if (mode === "day") {
      const weekPd = periods[weekKey];
      const dayPd = periods[key] || { tubes: [] };
      const weekTube = weekPd?.tubes.find((t) => t.id === id);
      if (!weekTube) return;
      
      const dayEntry = dayPd.tubes.find((t) => t.activity_id === weekTube.activity_id);
      const currentHours = dayEntry?.hours || 0;
      await get().setHours(id, currentHours + hours);
      return;
    }
    
    const pd = periods[key];
    if (!pd) return;
    const max = maxHours(mode);
    const used = pd.tubes.reduce((s, t) => s + t.hours, 0);
    const toAdd = Math.min(hours, max - used);
    if (toAdd <= 0) return;

    const tube = pd.tubes.find((t) => t.id === id);
    const newHours = (tube?.hours || 0) + toAdd;
    
    set({
      periods: {
        ...periods,
        [key]: {
          tubes: pd.tubes.map((t) =>
            t.id === id ? { ...t, hours: t.hours + toAdd } : t
          ),
        },
      },
    });

    if (tube?.time_entry_id) {
      debouncedHoursSync(tube.time_entry_id, newHours);
    }
  },

  removeHours: async (id, hours) => {
    const { mode, currentDate, periods } = get();
    const key = periodKey(currentDate, mode);
    const weekKey = periodKey(currentDate, "week");
    
    if (mode === "day") {
      const weekPd = periods[weekKey];
      const dayPd = periods[key] || { tubes: [] };
      const weekTube = weekPd?.tubes.find((t) => t.id === id);
      if (!weekTube) return;
      
      const dayEntry = dayPd.tubes.find((t) => t.activity_id === weekTube.activity_id);
      const currentHours = dayEntry?.hours || 0;
      await get().setHours(id, Math.max(0, currentHours - hours));
      return;
    }
    
    const pd = periods[key];
    if (!pd) return;

    const tube = pd.tubes.find((t) => t.id === id);
    const newHours = Math.max(0, (tube?.hours || 0) - hours);
    
    set({
      periods: {
        ...periods,
        [key]: {
          tubes: pd.tubes.map((t) =>
            t.id === id ? { ...t, hours: Math.max(0, t.hours - hours) } : t
          ),
        },
      },
    });

    if (tube?.time_entry_id) {
      debouncedHoursSync(tube.time_entry_id, newHours);
    }
  },

  resetPeriod: async () => {
    const { mode, currentDate, periods, userId } = get();
    const key = periodKey(currentDate, mode);
    const pd = periods[key];
    colorIdx = 0;
    const { [key]: _, ...rest } = periods;
    
    set({ periods: rest });

    if (userId && pd) {
      try {
        const timeEntryIds = pd.tubes.map(t => t.time_entry_id).filter(Boolean) as string[];
        const activityIds = pd.tubes.map(t => t.activity_id).filter(Boolean) as string[];
        
        if (timeEntryIds.length > 0) {
          await supabase.from("time_entries").delete().in("id", timeEntryIds);
        }
        if (activityIds.length > 0) {
          await supabase.from("goals").delete().in("activity_id", activityIds);
          await supabase.from("activities").delete().in("id", activityIds);
        }
        
        // Remove goals for deleted activities from local state
        set({ goals: get().goals.filter(g => !activityIds.includes(g.activity_id)) });
      } catch (err) {
        console.error("Failed to sync resetPeriod to DB:", err);
      }
    }
  },

  setGoal: async (activityId, targetHours, periodType) => {
    const { userId, goals } = get();
    
    const existing = goals.find(g => g.activity_id === activityId && g.period_type === periodType);
    
    if (existing) {
      // Update existing goal optimistically
      set({
        goals: goals.map(g =>
          g.activity_id === activityId && g.period_type === periodType
            ? { ...g, target_hours: targetHours }
            : g
        ),
      });
      
      if (userId && userId !== "demo" && existing.id) {
        try {
          await supabase
            .from("goals")
            .update({ target_hours: targetHours })
            .eq("id", existing.id);
        } catch (err) {
          console.error("Failed to update goal in DB:", err);
        }
      }
    } else {
      // Create new goal optimistically
      const newGoal: Goal = { activity_id: activityId, target_hours: targetHours, period_type: periodType };
      set({ goals: [...goals, newGoal] });
      
      if (userId && userId !== "demo") {
        try {
          const { data, error } = await supabase
            .from("goals")
            .insert({
              user_id: userId,
              activity_id: activityId,
              target_hours: targetHours,
              period_type: periodType,
            })
            .select()
            .single();
          
          if (!error && data) {
            set({
              goals: get().goals.map(g =>
                g.activity_id === activityId && g.period_type === periodType && !g.id
                  ? { ...g, id: data.id }
                  : g
              ),
            });
          }
        } catch (err) {
          console.error("Failed to create goal in DB:", err);
        }
      }
    }
  },

  removeGoal: async (activityId, periodType) => {
    const { userId, goals } = get();
    const existing = goals.find(g => g.activity_id === activityId && g.period_type === periodType);
    
    set({
      goals: goals.filter(g => !(g.activity_id === activityId && g.period_type === periodType)),
    });
    
    if (userId && userId !== "demo" && existing?.id) {
      try {
        await supabase.from("goals").delete().eq("id", existing.id);
      } catch (err) {
        console.error("Failed to delete goal from DB:", err);
      }
    }
  },

  getGoal: (activityId, periodType) => {
    return get().goals.find(g => g.activity_id === activityId && g.period_type === periodType);
  },

  loadFromDb: async () => {
    const { userId } = get();
    if (!userId) return;

    set({ loading: true });
    try {
      // Fetch time entries and goals in parallel
      const [entriesResult, goalsResult] = await Promise.all([
        supabase
          .from("time_entries")
          .select(`
            id,
            period_key,
            period_type,
            hours,
            activities (
              id,
              name,
              color
            )
          `)
          .eq("user_id", userId),
        supabase
          .from("goals")
          .select("id, activity_id, target_hours, period_type")
          .eq("user_id", userId),
      ]);

      if (entriesResult.error) throw entriesResult.error;

      // Build periods from DB data
      const periods: Record<string, PeriodData> = {};
      
      for (const entry of entriesResult.data || []) {
        const key = entry.period_key;
        if (!periods[key]) {
          periods[key] = { tubes: [] };
        }
        
        const activity = entry.activities as unknown as { id: string; name: string; color: string } | null;
        if (activity) {
          periods[key].tubes.push({
            id: crypto.randomUUID(),
            name: activity.name,
            hours: entry.hours,
            color: activity.color,
            activity_id: activity.id,
            time_entry_id: entry.id,
          });
        }
      }

      // Build goals from DB data
      const goals: Goal[] = (goalsResult.data || []).map((g: { id: string; activity_id: string; target_hours: number; period_type: string }) => ({
        id: g.id,
        activity_id: g.activity_id,
        target_hours: g.target_hours,
        period_type: g.period_type as ViewMode,
      }));

      set({ periods, goals, initialized: true });
    } catch (err) {
      console.error("Failed to load from DB:", err);
    } finally {
      set({ loading: false });
    }
  },

  syncToDb: async () => {
    // Handled by individual operations with optimistic updates
  },
}));
