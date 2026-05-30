"use client";

import { useEffect, useRef, useState } from "react";
import type { Suggestion } from "@/app/api/search/suggestions/route";

export type { Suggestion };

interface SearchInputProps {
  value: string;
  onChange: (v: string) => void;
  onSearch: (query: string) => void;
  onSuggestionSelect: (suggestion: Suggestion) => void;
  recentSearches?: string[];
  onRecentSelect?: (query: string) => void;
  placeholder?: string;
  loading?: boolean;
}

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

export default function SearchInput({
  value,
  onChange,
  onSearch,
  onSuggestionSelect,
  recentSearches,
  onRecentSelect,
  placeholder = "Search campsites…",
  loading = false,
}: SearchInputProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showRecents, setShowRecents] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced suggestions fetch
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search/suggestions?q=${encodeURIComponent(value.trim())}`
        );
        if (!res.ok) return;
        const data = (await res.json()) as { suggestions: Suggestion[] };
        setSuggestions(data.suggestions);
        setShowSuggestions(data.suggestions.length > 0);
        setHighlightedIdx(-1);
      } catch {
        // Silently swallow — search still works without suggestions
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
        setShowRecents(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleFocus() {
    if (value.trim().length < MIN_QUERY_LENGTH && recentSearches?.length) {
      setShowRecents(true);
    }
  }

  function handleChange(v: string) {
    onChange(v);
    if (v.trim().length >= MIN_QUERY_LENGTH) {
      setShowRecents(false);
    } else if (recentSearches?.length) {
      setShowRecents(true);
      setShowSuggestions(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    const activeDropdown = showSuggestions ? suggestions : [];
    if (!showSuggestions && !showRecents) {
      if (e.key === "Enter") { e.preventDefault(); handleSubmit(); }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIdx((i) => Math.min(i + 1, activeDropdown.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setShowRecents(false);
      setHighlightedIdx(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (showSuggestions && highlightedIdx >= 0) {
        selectSuggestion(suggestions[highlightedIdx]);
      } else {
        handleSubmit();
      }
    }
  }

  function selectSuggestion(s: Suggestion) {
    setShowSuggestions(false);
    setShowRecents(false);
    setSuggestions([]);
    onSuggestionSelect(s);
  }

  function handleSubmit() {
    const q = value.trim();
    if (!q) return;
    // Exact-match check: region beats campsite when both match (regions appear first in suggestions).
    const exactMatch = suggestions.find(
      (s) => s.name.toLowerCase() === q.toLowerCase()
    );
    if (exactMatch) {
      selectSuggestion(exactMatch);
    } else {
      setShowSuggestions(false);
      setShowRecents(false);
      onSearch(q);
    }
  }

  const focused = showSuggestions || showRecents;

  return (
    <div ref={containerRef} className="relative">
      {/* Input row */}
      <div
        className="flex items-center gap-2 rounded-xl border bg-[#faf8f4] px-3 py-2.5 transition-colors duration-200"
        style={{ borderColor: focused || value ? "#2d4a2d" : "#e0dbd0" }}
      >
        <span className="shrink-0 text-sm text-[#5a7a5a]">🔍</span>
        <input
          type="text"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={loading}
          className="min-w-0 flex-1 bg-transparent text-sm text-[#1a2e1a] outline-none placeholder:text-[#8a9e8a] disabled:opacity-60"
        />
        <button
          onClick={handleSubmit}
          disabled={!value.trim() || loading}
          className={`flex shrink-0 min-w-[56px] items-center justify-center gap-1.5 rounded-[8px] px-3 py-1.5 text-xs font-bold transition-colors disabled:cursor-not-allowed ${
            value.trim() ? "bg-[#e8674a] text-white" : "bg-[#e8ddd4] text-[#8a9e8a]"
          }`}
        >
          {loading ? (
            <span className="inline-block h-[11px] w-[11px] animate-spin rounded-full border-2 border-white/35 border-t-white" />
          ) : (
            "Pitch"
          )}
        </button>
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-2xl border border-[#e0dbd0] bg-white shadow-[0_8px_24px_rgba(45,74,45,0.12)]">
          {suggestions.map((s, i) => (
            <button
              key={s.kind === "campsite" ? s.id : `region-${s.name}`}
              onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s); }}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                i === highlightedIdx ? "bg-[#f0f5f0]" : "hover:bg-[#f7f5f0]"
              } ${i < suggestions.length - 1 ? "border-b border-[#f0ede8]" : ""}`}
            >
              <span className="text-base">{s.kind === "campsite" ? "⛺" : "📍"}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-[#1a2e1a]">
                  {s.name}
                </span>
                <span className="block truncate text-[11px] text-[#5a7a5a]">
                  {s.kind === "campsite"
                    ? [s.region, s.state].filter(Boolean).join(", ")
                    : `Region · ${s.state} · ${s.count} campsite${s.count === 1 ? "" : "s"}`}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Recents dropdown (map bar only — shown when input is empty/short) */}
      {showRecents && !showSuggestions && recentSearches && recentSearches.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-2xl border border-[#e0dbd0] bg-white shadow-[0_8px_24px_rgba(45,74,45,0.12)]">
          {recentSearches.map((recent, i) => (
            <button
              key={recent}
              onMouseDown={(e) => {
                e.preventDefault();
                setShowRecents(false);
                onRecentSelect?.(recent);
              }}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-[#1a2e1a] transition-colors hover:bg-[#f7f5f0] ${
                i < recentSearches.length - 1 ? "border-b border-[#f0ede8]" : ""
              }`}
            >
              <span className="text-[#5a7a5a]">🕐</span>
              <span className="flex-1 truncate">{recent}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
