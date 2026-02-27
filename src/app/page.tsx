"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  useTimeStore,
  periodKey,
  periodLabel,
  maxHours,
  isCurrentPeriod,
  type ViewMode,
  type Tube,
} from "@/store/useTimeStore";
import { SignOutButton } from "@/components/AuthProvider";

const TubeCanvas = dynamic(() => import("@/components/WaterTube"), {
  ssr: false,
  loading: () => <div className="h-full" />,
});

// --- Goal progress ring SVG ---
function GoalRing({ progress, color, size = 36 }: { progress: number; color: string; size?: number }) {
  const r = (size - 4) / 2;
  const circ = 2 * Math.PI * r;
  const filled = Math.min(1, Math.max(0, progress));
  const offset = circ * (1 - filled);
  const isComplete = progress >= 1;
  return (
    <svg width={size} height={size} className="block">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={2.5} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={isComplete ? "#10b981" : color}
        strokeWidth={2.5}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-all duration-500 ease-out"
      />
      {isComplete && (
        <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="central" fontSize={size * 0.35} fill="#10b981">
          ✓
        </text>
      )}
    </svg>
  );
}

// --- Goal inline editor ---
function GoalEditor({
  tube,
  mode,
}: {
  tube: Tube;
  mode: ViewMode;
}) {
  const goals = useTimeStore((s) => s.goals);
  const setGoal = useTimeStore((s) => s.setGoal);
  const removeGoal = useTimeStore((s) => s.removeGoal);

  const activityId = tube.activity_id;
  const goal = activityId ? goals.find((g) => g.activity_id === activityId && g.period_type === mode) : undefined;

  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");

  const startEditing = useCallback(() => {
    setVal(goal ? String(goal.target_hours) : "");
    setEditing(true);
  }, [goal]);

  const save = useCallback(() => {
    const n = parseFloat(val);
    if (activityId && !isNaN(n) && n > 0) {
      setGoal(activityId, n, mode);
    } else if (activityId && (val.trim() === "" || val.trim() === "0")) {
      removeGoal(activityId, mode);
    }
    setEditing(false);
  }, [activityId, val, mode, setGoal, removeGoal]);

  if (!activityId) return null;

  const progress = goal ? tube.hours / goal.target_hours : 0;

  if (editing) {
    return (
      <div className="flex items-center justify-center gap-1 mt-1">
        <span className="text-[9px] text-gray-400">Goal:</span>
        <input
          type="number"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
          autoFocus
          placeholder="hrs"
          className="w-12 bg-gray-100 px-1 py-0.5 rounded text-center text-[10px] font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="text-[9px] text-gray-300">h</span>
      </div>
    );
  }

  if (goal) {
    const pct = Math.min(100, Math.round(progress * 100));
    return (
      <div
        className="flex items-center justify-center gap-1.5 mt-1 cursor-pointer group/goal"
        onClick={startEditing}
        title="Click to edit goal"
      >
        <GoalRing progress={progress} color={tube.color} size={22} />
        <span className={`text-[9px] font-bold tabular-nums ${pct >= 100 ? "text-emerald-500" : "text-gray-400"}`}>
          {tube.hours}/{goal.target_hours}h
        </span>
        <span className={`text-[9px] font-bold tabular-nums ${pct >= 100 ? "text-emerald-500" : "text-gray-300"}`}>
          ({pct}%)
        </span>
      </div>
    );
  }

  return (
    <button
      onClick={startEditing}
      className="mt-1 text-[9px] text-gray-200 hover:text-indigo-400 transition-colors font-medium opacity-0 group-hover:opacity-100"
    >
      + goal
    </button>
  );
}

export default function Home() {
  const mode = useTimeStore((s) => s.mode);
  const currentDate = useTimeStore((s) => s.currentDate);
  const periods = useTimeStore((s) => s.periods);
  const setMode = useTimeStore((s) => s.setMode);
  const goToday = useTimeStore((s) => s.goToday);
  const navigate = useTimeStore((s) => s.navigate);
  const addTube = useTimeStore((s) => s.addTube);
  const removeTube = useTimeStore((s) => s.removeTube);
  const renameTube = useTimeStore((s) => s.renameTube);
  const setHours = useTimeStore((s) => s.setHours);
  const addHours = useTimeStore((s) => s.addHours);
  const removeHours = useTimeStore((s) => s.removeHours);
  const resetPeriod = useTimeStore((s) => s.resetPeriod);

  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [hourInputId, setHourInputId] = useState<string | null>(null);
  const [hourInputVal, setHourInputVal] = useState("");

  const key = periodKey(currentDate, mode);
  // In day mode, show activities from the parent week
  const weekKey = periodKey(currentDate, "week");
  const weekTubes = periods[weekKey]?.tubes ?? [];
  const dayTubes = periods[key]?.tubes ?? [];
  
  // In day mode, use week activities but with day-specific hours
  const tubes = useMemo(() => {
    const unsorted = mode === "day" 
      ? weekTubes.map(weekTube => {
          const dayEntry = dayTubes.find(dt => dt.activity_id === weekTube.activity_id);
          return dayEntry || { ...weekTube, hours: 0, time_entry_id: undefined };
        })
      : periods[key]?.tubes ?? [];
    return [...unsorted].sort((a, b) => b.hours - a.hours);
  }, [mode, weekTubes, dayTubes, periods, key]);

  const max = maxHours(mode);
  const usedHours = tubes.reduce((sum, t) => sum + t.hours, 0);
  const remainingHours = max - usedHours;
  const isCurrent = isCurrentPeriod(currentDate, mode);
  const label = periodLabel(currentDate, mode);
  const pct = max > 0 ? (usedHours / max) * 100 : 0;

  // Calculate hours remaining in the current period based on current time
  const [hoursLeftInPeriod, setHoursLeftInPeriod] = useState<number | null>(null);
  
  useEffect(() => {
    const calculateHoursLeft = () => {
      const now = new Date();
      let endTime: Date;
      
      if (mode === "day") {
        endTime = new Date(now);
        endTime.setHours(23, 59, 59, 999);
      } else {
        const day = now.getDay();
        const daysUntilSunday = day === 0 ? 0 : 7 - day;
        endTime = new Date(now);
        endTime.setDate(now.getDate() + daysUntilSunday);
        endTime.setHours(23, 59, 59, 999);
      }
      
      const msLeft = endTime.getTime() - now.getTime();
      const hoursLeft = Math.max(0, Math.floor(msLeft / (1000 * 60 * 60)));
      setHoursLeftInPeriod(hoursLeft);
    };
    
    calculateHoursLeft();
    const interval = setInterval(calculateHoursLeft, 60000);
    return () => clearInterval(interval);
  }, [mode]);

  const handleAdd = useCallback(() => {
    const name = newName.trim() || `Activity ${tubes.length + 1}`;
    addTube(name);
    setNewName("");
  }, [newName, tubes.length, addTube]);

  const startEdit = useCallback((id: string, name: string) => {
    setEditingId(id);
    setEditName(name);
  }, []);

  const finishEdit = useCallback((id: string) => {
    if (editName.trim()) renameTube(id, editName.trim());
    setEditingId(null);
  }, [editName, renameTube]);

  const startHourEdit = useCallback((id: string, currentH: number) => {
    setHourInputId(id);
    setHourInputVal(String(currentH));
  }, []);

  const finishHourEdit = useCallback((id: string) => {
    const n = parseInt(hourInputVal, 10);
    if (!isNaN(n)) setHours(id, n);
    setHourInputId(null);
  }, [hourInputVal, setHours]);

  return (
    <div className="min-h-screen bg-[#f8f8fa]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-2xl border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-black tracking-tight text-gray-900 select-none">
              tt<span className="text-indigo-500">.</span>
            </h1>
            <div className="h-4 w-px bg-gray-200" />
            <a
              href="/analytics"
              className="text-[11px] font-bold uppercase tracking-wider text-gray-300 hover:text-indigo-500 transition-colors"
            >
              Analytics
            </a>
            <SignOutButton />
            <div className="h-4 w-px bg-gray-200" />
            <div className="flex text-[11px] font-bold uppercase tracking-wider">
              {(["day", "week"] as ViewMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-2.5 py-1 rounded transition-all ${
                    mode === m
                      ? "text-gray-900"
                      : "text-gray-300 hover:text-gray-500"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate(-1)}
              className="w-7 h-7 rounded-md hover:bg-gray-100 text-gray-400 flex items-center justify-center transition-colors text-sm"
            >
              &lsaquo;
            </button>
            <button
              onClick={isCurrent ? undefined : goToday}
              className="text-[12px] sm:text-[13px] font-semibold text-gray-900 px-1.5 py-1 rounded-md hover:bg-gray-50 transition-colors min-w-0 sm:min-w-[140px] text-center"
            >
              {label}
            </button>
            <button
              onClick={() => navigate(1)}
              className="w-7 h-7 rounded-md hover:bg-gray-100 text-gray-400 flex items-center justify-center transition-colors text-sm"
            >
              &rsaquo;
            </button>
            {!isCurrent && (
              <button
                onClick={goToday}
                className="ml-1 text-[10px] px-2 py-1 rounded bg-indigo-500 text-white font-bold uppercase tracking-wide hover:bg-indigo-600 transition-colors"
              >
                Now
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-16">
        {/* Summary strip */}
        <div className="flex items-center gap-3 sm:gap-6 mb-8 sm:mb-10">
          <div className="flex items-baseline gap-1 shrink-0">
            <span className="text-2xl sm:text-4xl font-black tabular-nums text-gray-900">{remainingHours}</span>
            <span className="text-xs sm:text-sm text-gray-300 font-semibold">/ {max}h free</span>
          </div>
          <div className="flex-1 h-1.5 bg-gray-200/60 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out bg-indigo-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs text-gray-400 font-semibold tabular-nums w-10 text-right">
            {pct.toFixed(0)}%
          </span>
        </div>
        
        {/* Hours remaining in period based on current time */}
        {hoursLeftInPeriod !== null && (
          <div className="text-xs text-gray-400 mt-2">
            <span className="font-semibold text-gray-500">{hoursLeftInPeriod}h</span> remaining in this {mode}
          </div>
        )}

        {/* Add row - only show in week mode */}
        {mode === "week" ? (
          <div className="flex items-center gap-2 mb-8 sm:mb-10">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="New activity..."
              className="flex-1 max-w-xs px-0 py-1 bg-transparent border-b border-gray-200 text-gray-900 placeholder-gray-300 text-sm focus:outline-none focus:border-gray-400 transition-colors"
            />
            <button
              onClick={handleAdd}
              className="text-xs font-bold text-gray-400 hover:text-gray-900 transition-colors uppercase tracking-wide"
            >
              + Add
            </button>
            {tubes.length > 0 && (
              <>
                <div className="h-3 w-px bg-gray-200 mx-1" />
                <button
                  onClick={resetPeriod}
                  className="text-xs text-gray-300 hover:text-red-400 transition-colors font-medium"
                >
                  Clear
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="mb-8 sm:mb-10">
            <p className="text-xs text-gray-400">Fill in hours for activities from this week</p>
          </div>
        )}

        {/* Tubes */}
        {tubes.length === 0 ? (
          <div className="text-center py-32">
            <p className="text-gray-300 text-sm">No activities yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-2 gap-y-6">
            {tubes.map((tube) => {
              const tubePct = max > 0 ? (tube.hours / max) * 100 : 0;
              return (
                <div key={tube.id} className="flex flex-col items-center group">
                  {/* 3D tube — free standing, no card */}
                  <div className="w-full aspect-[3/5] mb-2">
                    <TubeCanvas
                      hours={tube.hours}
                      maxHours={max}
                      color={tube.color}
                    />
                  </div>

                  {/* Name */}
                  <div className="w-full text-center mb-0.5">
                    {editingId === tube.id ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={() => finishEdit(tube.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") finishEdit(tube.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        autoFocus
                        className="bg-gray-100 px-2 py-0.5 rounded text-xs text-gray-900 w-full text-center focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      />
                    ) : (
                      <span
                        className="text-xs font-semibold text-gray-700 truncate block cursor-pointer hover:text-indigo-600 transition-colors"
                        onClick={() => startEdit(tube.id, tube.name)}
                        title="Click to rename"
                      >
                        {tube.name}
                      </span>
                    )}
                  </div>

                  {/* Hours (clickable to type) */}
                  <div className="text-center mb-1.5">
                    {hourInputId === tube.id ? (
                      <input
                        type="number"
                        value={hourInputVal}
                        onChange={(e) => setHourInputVal(e.target.value)}
                        onBlur={() => finishHourEdit(tube.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") finishHourEdit(tube.id);
                          if (e.key === "Escape") setHourInputId(null);
                        }}
                        autoFocus
                        className="w-16 bg-gray-100 px-2 py-0.5 rounded text-center text-sm font-black tabular-nums text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    ) : (
                      <span
                        className="text-base font-black tabular-nums cursor-pointer hover:opacity-70 transition-opacity"
                        style={{ color: tube.color }}
                        onClick={() => startHourEdit(tube.id, tube.hours)}
                        title="Click to set hours"
                      >
                        {tube.hours}h
                      </span>
                    )}
                    <span className="text-[9px] text-gray-300 font-medium block">
                      {tubePct.toFixed(1)}%
                    </span>
                  </div>

                  {/* Goal progress */}
                  <GoalEditor tube={tube} mode={mode} />

                  {/* Compact controls */}
                  <div className="flex items-center gap-0.5 mt-1">
                    <button
                      onClick={() => removeHours(tube.id, 1)}
                      disabled={tube.hours <= 0}
                      className="w-6 h-6 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 text-[11px] font-bold disabled:opacity-10 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                    >
                      &minus;
                    </button>
                    {(mode === "week" ? [1, 4, 8] : [1, 2, 4]).map((h) => (
                      <button
                        key={h}
                        onClick={() => addHours(tube.id, h)}
                        disabled={remainingHours <= 0}
                        className="px-1.5 h-6 text-[9px] rounded text-gray-300 hover:text-gray-500 hover:bg-gray-100 disabled:opacity-10 disabled:cursor-not-allowed transition-all font-bold"
                      >
                        +{h}
                      </button>
                    ))}
                    <button
                      onClick={() => addHours(tube.id, 1)}
                      disabled={remainingHours <= 0}
                      className="w-6 h-6 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 text-[11px] font-bold disabled:opacity-10 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>

                  {/* Delete — appears on hover, only in week mode */}
                  {mode === "week" && (
                    <button
                      onClick={() => removeTube(tube.id)}
                      className="mt-1 text-[9px] text-gray-200 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all font-medium"
                    >
                      remove
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
