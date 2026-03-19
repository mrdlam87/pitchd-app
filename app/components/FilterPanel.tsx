"use client";

import { useState } from "react";
import { CORAL, CORAL_LIGHT, FOREST_GREEN, TEXT, SURFACE, BORDER, TEXT_MUTED } from "@/lib/tokens";

export type FilterState = {
  activities: string[];
  pois: string[];
};

type FilterPanelProps = {
  initialFilters: FilterState;
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

function ToggleChip({
  item,
  active,
  onToggle,
}: {
  item: { key: string; label: string; emoji: string };
  active: boolean;
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
      {active && (
        <span
          className="text-[10px] leading-none ml-0.5"
          style={{ color: CORAL, fontWeight: 700 }}
        >
          ✓
        </span>
      )}
    </button>
  );
}

export default function FilterPanel({
  initialFilters,
  onApply,
  onClose,
}: FilterPanelProps) {
  const [activities, setActivities] = useState<string[]>(
    initialFilters.activities,
  );
  const [pois, setPois] = useState<string[]>(initialFilters.pois);

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

  function handleApply() {
    onApply({ activities, pois });
  }

  const sectionLabel =
    "text-[10px] font-bold uppercase tracking-[1.8px] mb-2.5 block";

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
          {(activities.length > 0 || pois.length > 0) && (
            <button
              type="button"
              onClick={() => {
                setActivities([]);
                setPois([]);
              }}
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
