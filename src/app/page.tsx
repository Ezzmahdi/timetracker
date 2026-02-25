"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import {
  useTimeStore,
  periodKey,
  periodLabel,
  maxHours,
  isCurrentPeriod,
  type ViewMode,
} from "@/store/useTimeStore";
import { SignOutButton } from "@/components/AuthProvider";

const TubeCanvas = dynamic(() => import("@/components/WaterTube"), {
  ssr: false,
  loading: () => <div className="h-full" />,
});

export default function Home() {
  const store = useTimeStore();
  const {
    mode,
    currentDate,
    periods,
    setMode,
    goToday,
    navigate,
    addTube,
    removeTube,
    renameTube,
    setHours,
    addHours,
    removeHours,
    resetPeriod,
  } = store;

  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [hourInputId, setHourInputId] = useState<string | null>(null);
  const [hourInputVal, setHourInputVal] = useState("");

  const key = periodKey(currentDate, mode);
  const tubes = periods[key]?.tubes ?? [];
  const max = maxHours(mode);
  const usedHours = tubes.reduce((sum, t) => sum + t.hours, 0);
  const remainingHours = max - usedHours;
  const isCurrent = isCurrentPeriod(currentDate, mode);
  const label = periodLabel(currentDate, mode);
  const pct = max > 0 ? (usedHours / max) * 100 : 0;

  const handleAdd = () => {
    const name = newName.trim() || `Activity ${tubes.length + 1}`;
    addTube(name);
    setNewName("");
  };

  const startEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditName(name);
  };

  const finishEdit = (id: string) => {
    if (editName.trim()) renameTube(id, editName.trim());
    setEditingId(null);
  };

  const startHourEdit = (id: string, currentH: number) => {
    setHourInputId(id);
    setHourInputVal(String(currentH));
  };

  const finishHourEdit = (id: string) => {
    const n = parseInt(hourInputVal, 10);
    if (!isNaN(n)) setHours(id, n);
    setHourInputId(null);
  };

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

        {/* Add row */}
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

                  {/* Compact controls */}
                  <div className="flex items-center gap-0.5">
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

                  {/* Delete — appears on hover */}
                  <button
                    onClick={() => removeTube(tube.id)}
                    className="mt-1 text-[9px] text-gray-200 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all font-medium"
                  >
                    remove
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
