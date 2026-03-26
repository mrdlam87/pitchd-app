"use client";

import { useMemo, useState } from "react";
import { CORAL, CORAL_LIGHT, FOREST_GREEN, TEXT, SURFACE, BORDER, TEXT_MUTED } from "@/lib/tokens";

export type FilterState = {
  activities: string[];
  pois: string[];
  startDate: string | null;
  endDate: string | null;
};

type FilterPanelProps = {
  initialFilters: FilterState;
  // Activities inferred by the last AI search — shown with a "Pitchd" badge.
  aiSyncedActivities?: string[];
  onApply: (filters: FilterState) => void;
  onClose: () => void;
};

const ACTIVITY_OPTIONS = [
  { key: "dog_friendly", label: "Dog friendly", emoji: "🐕" },
  { key: "fishing", label: "Fishing", emoji: "🎣" },
  { key: "hiking", label: "Hiking", emoji: "🥾" },
  { key: "swimming", label: "Swimming", emoji: "🏊" },
];

const POI_OPTIONS = [
  { key: "dump_point", label: "Dump points", emoji: "🚐" },
  { key: "water_fill", label: "Water fill", emoji: "💧" },
  { key: "laundromat", label: "Laundromat", emoji: "🧺" },
  { key: "toilets", label: "Toilets", emoji: "🚻" },
];

const SHORT_DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const FULL_DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function ToggleChip({
  item,
  active,
  aiSynced,
  onToggle,
}: {
  item: { key: string; label: string; emoji: string };
  active: boolean;
  aiSynced?: boolean;
  onToggle: (key: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(item.key)}
      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full cursor-pointer select-none transition-all duration-150 mb-2 mr-2"
      style={{
        border: `1.5px solid ${active ? CORAL : BORDER}`,
        background: active ? CORAL_LIGHT : SURFACE,
        boxShadow: active
          ? `0 0 0 1px ${CORAL}`
          : "0 1px 3px rgba(0,0,0,0.06)",
        fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
      }}
      aria-pressed={active}
    >
      <span className="text-base leading-none">{item.emoji}</span>
      <span
        className="text-xs leading-none"
        style={{
          fontWeight: active ? 600 : 400,
          color: active ? CORAL : TEXT,
        }}
      >
        {item.label}
      </span>
      {active && !aiSynced && (
        <span
          className="text-[10px] leading-none ml-0.5"
          style={{ color: CORAL, fontWeight: 700 }}
        >
          ✓
        </span>
      )}
      {active && aiSynced && (
        <span
          className="text-[9px] leading-none ml-0.5 px-1 py-0.5 rounded-full"
          style={{ background: CORAL, color: "#fff", fontWeight: 700, letterSpacing: "0.02em" }}
        >
          Pitchd
        </span>
      )}
    </button>
  );
}

export default function FilterPanel({
  initialFilters,
  aiSyncedActivities = [],
  onApply,
  onClose,
}: FilterPanelProps) {
  const [activities, setActivities] = useState<string[]>(initialFilters.activities);
  const [pois, setPois] = useState<string[]>(initialFilters.pois);

  // Date state: d0 = start, d1 = end (both as Date objects or null for easy comparison)
  const [d0, setD0] = useState<Date | null>(() => {
    if (!initialFilters.startDate) return null;
    const d = new Date(initialFilters.startDate + "T00:00:00");
    return isNaN(d.getTime()) ? null : d;
  });
  const [d1, setD1] = useState<Date | null>(() => {
    if (!initialFilters.endDate) return null;
    const d = new Date(initialFilters.endDate + "T00:00:00");
    return isNaN(d.getTime()) ? null : d;
  });

  // Build the 7-day strip starting from today — memoised so it isn't rebuilt on
  // every re-render triggered by date-pick state changes.
  const dateStrip = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      return d;
    });
  }, []);

  function pickDate(d: Date) {
    if (!d0 || (d0 && d1)) {
      // No start selected, or range already complete — start fresh
      setD0(d);
      setD1(null);
    } else if (d.getTime() === d0.getTime()) {
      // Tapping the start again clears it
      setD0(null);
    } else if (d < d0) {
      // Tapped before start — swap
      setD1(d0);
      setD0(d);
    } else {
      // Tapped after start — set end
      setD1(d);
    }
  }

  function rangeLabel(): string {
    if (!d0) return "Select start date";
    const s = `${FULL_DAYS[d0.getDay()]} ${d0.getDate()} ${MONTHS[d0.getMonth()]}`;
    if (!d1) return `${s} — select end date`;
    const nights = Math.round((d1.getTime() - d0.getTime()) / 86_400_000);
    return `${s} → ${FULL_DAYS[d1.getDay()]} ${d1.getDate()} ${MONTHS[d1.getMonth()]} · ${nights} ${nights === 1 ? "night" : "nights"}`;
  }

  function toggleActivity(key: string) {
    setActivities((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  function togglePoi(key: string) {
    setPois((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  function handleClearAll() {
    setActivities([]);
    setPois([]);
    setD0(null);
    setD1(null);
  }

  function handleApply() {
    onApply({
      activities,
      pois,
      startDate: d0 ? isoDate(d0) : null,
      endDate: d1 ? isoDate(d1) : null,
    });
  }

  const hasAnyFilter = activities.length > 0 || pois.length > 0 || d0 !== null;
  const sectionLabel = "text-[10px] font-bold uppercase tracking-[1.8px] mb-2.5 block";

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col"
      style={{
        background: SURFACE,
        fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
        color: FOREST_GREEN,
      }}
    >
      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 pb-3 pt-[max(3rem,env(safe-area-inset-top))]"
        style={{ borderBottom: `1px solid ${BORDER}`, background: "#fff" }}
      >
        <span
          className="text-[11px] font-bold uppercase tracking-[1.8px]"
          style={{ color: TEXT_MUTED }}
        >
          Filters
        </span>
        <div className="flex items-center gap-3">
          {hasAnyFilter && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-xs transition-opacity hover:opacity-70 active:opacity-50"
              style={{ color: CORAL, fontWeight: 600 }}
            >
              Clear all
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-full transition-opacity hover:opacity-70 active:opacity-50"
            style={{ color: TEXT_MUTED, fontSize: 18, lineHeight: 1 }}
            aria-label="Close filters"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-8">
        {/* Activities */}
        <div className="mb-6">
          <span className={sectionLabel} style={{ color: TEXT_MUTED }}>
            Activities
          </span>
          <div className="flex flex-wrap">
            {ACTIVITY_OPTIONS.map((item) => (
              <ToggleChip
                key={item.key}
                item={item}
                active={activities.includes(item.key)}
                aiSynced={aiSyncedActivities.includes(item.key)}
                onToggle={toggleActivity}
              />
            ))}
          </div>
        </div>

        {/* POIs */}
        <div className="mb-6">
          <span className={sectionLabel} style={{ color: TEXT_MUTED }}>
            Points of Interest
          </span>
          <div className="flex flex-wrap">
            {POI_OPTIONS.map((item) => (
              <ToggleChip
                key={item.key}
                item={item}
                active={pois.includes(item.key)}
                onToggle={togglePoi}
              />
            ))}
          </div>
          {pois.length > 0 && (
            <p
              className="text-[11px] mt-1 italic"
              style={{ color: TEXT_MUTED }}
            >
              These will appear as pins alongside campsites on the map.
            </p>
          )}
        </div>

        {/* Dates */}
        <div className="mb-6">
          <span className={sectionLabel} style={{ color: TEXT_MUTED }}>
            Dates
          </span>
          {/* When AI infers dates beyond the 7-day strip, no chip is highlighted.
              Show the active range as a text banner so it isn't invisible. */}
          {d0 !== null && d0.getTime() > dateStrip[dateStrip.length - 1].getTime() && (
            <p
              className="text-[11px] mb-2 px-2 py-1.5 rounded-lg"
              style={{ color: CORAL, background: "rgba(232,103,74,0.08)", border: `1px solid rgba(232,103,74,0.2)` }}
            >
              {rangeLabel()} — tap below to change
            </p>
          )}
          {/* 7-day grid */}
          <div className="grid grid-cols-7 gap-1.5 mb-2">
            {dateStrip.map((d) => {
              const isStart = d0 !== null && d.getTime() === d0.getTime();
              const isEnd = d1 !== null && d.getTime() === d1.getTime();
              const isSelected = isStart || isEnd;
              const inRange = d0 !== null && d1 !== null && d > d0 && d < d1;

              return (
                <button
                  key={d.getTime()}
                  type="button"
                  onClick={() => pickDate(d)}
                  className="flex flex-col items-center py-2 rounded-[10px] transition-all duration-150 cursor-pointer"
                  style={{
                    border: `1.5px solid ${
                      isSelected
                        ? CORAL
                        : inRange
                          ? "rgba(232,103,74,0.3)"
                          : BORDER
                    }`,
                    background: isSelected ? CORAL : inRange ? CORAL_LIGHT : "#fff",
                    boxShadow: isSelected
                      ? "0 2px 8px rgba(232,103,74,0.3)"
                      : "0 1px 3px rgba(0,0,0,0.06)",
                  }}
                  aria-pressed={isSelected}
                  aria-label={`${FULL_DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`}
                >
                  <span
                    className="text-[8px] font-bold uppercase leading-none"
                    style={{
                      letterSpacing: "0.3px",
                      color: isSelected
                        ? "rgba(255,255,255,0.8)"
                        : inRange
                          ? CORAL
                          : TEXT_MUTED,
                    }}
                  >
                    {SHORT_DAYS[d.getDay()]}
                  </span>
                  <span
                    className="text-[15px] font-bold leading-none mt-0.5"
                    style={{ color: isSelected ? "#fff" : FOREST_GREEN }}
                  >
                    {d.getDate()}
                  </span>
                </button>
              );
            })}
          </div>
          {/* Range label */}
          <p
            className="text-[11px]"
            style={{ color: d0 && d1 ? CORAL : TEXT_MUTED }}
          >
            {rangeLabel()}
          </p>
        </div>
      </div>

      {/* CTA footer */}
      <div
        className="flex-shrink-0 px-4 py-4"
        style={{ borderTop: `1px solid ${BORDER}`, background: "#fff" }}
      >
        <button
          type="button"
          onClick={handleApply}
          className="w-full py-3.5 rounded-2xl font-semibold text-sm transition-opacity hover:opacity-90 active:opacity-75"
          style={{
            background: CORAL,
            color: "#fff",
            fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
          }}
        >
          Search with these filters
        </button>
      </div>
    </div>
  );
}
