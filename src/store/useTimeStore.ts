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

export type ViewMode = "week" | "day";

interface PeriodData {
  tubes: Tube[];
}

interface TimeStore {
  mode: ViewMode;
  currentDate: string; // ISO date string YYYY-MM-DD
  periods: Record<string, PeriodData>; // key = period key
  userId: string | null;
  loading: boolean;
  initialized: boolean;

  setUserId: (userId: string | null) => void;
  setMode: (mode: ViewMode) => void;
  goToday: () => void;
  navigate: (delta: number) => void;
  addTube: (name: string) => void;
  removeTube: (id: string) => void;
  renameTube: (id: string, name: string) => void;
  setHours: (id: string, hours: number) => void;
  addHours: (id: string, hours: number) => void;
  removeHours: (id: string, hours: number) => void;
  resetPeriod: () => void;
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

// --- Store ---

export const useTimeStore = create<TimeStore>((set, get) => ({
  mode: "week",
  currentDate: todayStr(),
  periods: {},
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
    const pd = periods[key];
    if (!pd) return;
    const max = maxHours(mode);
    const otherUsed = pd.tubes.reduce((s, t) => s + (t.id === id ? 0 : t.hours), 0);
    const clamped = Math.max(0, Math.min(hours, max - otherUsed));
    
    const tube = pd.tubes.find((t) => t.id === id);
    
    // Optimistic update
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

    // Sync to DB
    if (userId && tube?.time_entry_id) {
      try {
        await supabase
          .from("time_entries")
          .update({ hours: clamped })
          .eq("id", tube.time_entry_id);
      } catch (err) {
        console.error("Failed to sync setHours to DB:", err);
      }
    }
  },

  addHours: async (id, hours) => {
    const { mode, currentDate, periods, userId } = get();
    const key = periodKey(currentDate, mode);
    const pd = periods[key];
    if (!pd) return;
    const max = maxHours(mode);
    const used = pd.tubes.reduce((s, t) => s + t.hours, 0);
    const toAdd = Math.min(hours, max - used);
    if (toAdd <= 0) return;

    const tube = pd.tubes.find((t) => t.id === id);
    const newHours = (tube?.hours || 0) + toAdd;
    
    // Optimistic update
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

    // Sync to DB
    if (userId && tube?.time_entry_id) {
      try {
        await supabase
          .from("time_entries")
          .update({ hours: newHours })
          .eq("id", tube.time_entry_id);
      } catch (err) {
        console.error("Failed to sync addHours to DB:", err);
      }
    }
  },

  removeHours: async (id, hours) => {
    const { mode, currentDate, periods, userId } = get();
    const key = periodKey(currentDate, mode);
    const pd = periods[key];
    if (!pd) return;

    const tube = pd.tubes.find((t) => t.id === id);
    const newHours = Math.max(0, (tube?.hours || 0) - hours);
    
    // Optimistic update
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

    // Sync to DB
    if (userId && tube?.time_entry_id) {
      try {
        await supabase
          .from("time_entries")
          .update({ hours: newHours })
          .eq("id", tube.time_entry_id);
      } catch (err) {
        console.error("Failed to sync removeHours to DB:", err);
      }
    }
  },

  resetPeriod: async () => {
    const { mode, currentDate, periods, userId } = get();
    const key = periodKey(currentDate, mode);
    const pd = periods[key];
    colorIdx = 0;
    const { [key]: _, ...rest } = periods;
    
    // Optimistic update
    set({ periods: rest });

    // Sync to DB - delete all time entries and activities for this period
    if (userId && pd) {
      try {
        for (const tube of pd.tubes) {
          if (tube.time_entry_id) {
            await supabase.from("time_entries").delete().eq("id", tube.time_entry_id);
          }
          if (tube.activity_id) {
            await supabase.from("activities").delete().eq("id", tube.activity_id);
          }
        }
      } catch (err) {
        console.error("Failed to sync resetPeriod to DB:", err);
      }
    }
  },

  loadFromDb: async () => {
    const { userId } = get();
    if (!userId) return;

    set({ loading: true });
    try {
      // Fetch all time entries with their activities
      const { data: entries, error } = await supabase
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
        .eq("user_id", userId);

      if (error) throw error;

      // Build periods from DB data
      const periods: Record<string, PeriodData> = {};
      
      for (const entry of entries || []) {
        const key = entry.period_key;
        if (!periods[key]) {
          periods[key] = { tubes: [] };
        }
        
        const activity = entry.activities as unknown as { id: string; name: string; color: string } | null;
        if (activity) {
          periods[key].tubes.push({
            id: crypto.randomUUID(), // Local ID for React keys
            name: activity.name,
            hours: entry.hours,
            color: activity.color,
            activity_id: activity.id,
            time_entry_id: entry.id,
          });
        }
      }

      set({ periods, initialized: true });
    } catch (err) {
      console.error("Failed to load from DB:", err);
    } finally {
      set({ loading: false });
    }
  },

  syncToDb: async () => {
    // This is handled by individual operations with optimistic updates
    // Can be used for manual full sync if needed
  },
}));
