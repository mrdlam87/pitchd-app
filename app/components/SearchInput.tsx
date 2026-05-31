"use client";

import React, { useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Suggestion } from "@/app/api/search/suggestions/route";
import { BORDER, CORAL, FOREST_GREEN, SAGE, TEXT, TEXT_MUTED } from "@/lib/tokens";

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
  /** "pill" renders the original map search bar style (white rounded-full, circular icon button).
   *  "default" renders the HomeScreen card style (bordered rounded-xl, "Pitch" button). */
  variant?: "default" | "pill";
  /** Slot rendered inside the pill after the submit button (e.g. divider + Filters button). */
  pillTrailing?: React.ReactNode;
  onFocus?: () => void;
  onBlur?: () => void;
  /** Called when the user taps the clear (×) button in the pill. When provided, the
   *  circular button shows × instead of the search icon whenever the input has a value. */
  onClear?: () => void;
}

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

export interface SearchInputHandle {
  focus: () => void;
  inputElement: () => HTMLInputElement | null;
}

const SearchInput = React.forwardRef<SearchInputHandle, SearchInputProps>(function SearchInput({
  value,
  onChange,
  onSearch,
  onSuggestionSelect,
  recentSearches,
  onRecentSelect,
  placeholder = "Search campsites…",
  loading = false,
  variant = "default",
  pillTrailing,
  onFocus: onFocusProp,
  onBlur: onBlurProp,
  onClear,
}, ref) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showRecents, setShowRecents] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    inputElement: () => inputRef.current,
  }));
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

  // Close dropdowns when the user interacts outside the search container —
  // covers mouse clicks (desktop) and touch taps/drags (mobile). touchstart
  // is what fires when a user drags the drawer handle or taps the map, so
  // mousedown alone was insufficient on mobile.
  useEffect(() => {
    function handleOutside(e: MouseEvent | TouchEvent) {
      const target =
        e.type === "touchstart"
          ? ((e as TouchEvent).touches[0]?.target as Node | null)
          : (e.target as Node);
      if (target && containerRef.current && !containerRef.current.contains(target)) {
        setShowSuggestions(false);
        setShowRecents(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener("mousedown", handleOutside);
    // passive: true — we never call preventDefault here, so the browser can
    // optimise scroll/touch handling without waiting for this listener.
    document.addEventListener("touchstart", handleOutside, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, []);

  function openRecentsIfEligible() {
    if (!showSuggestions && value.trim().length < MIN_QUERY_LENGTH && recentSearches?.length) {
      setShowRecents(true);
    }
  }

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    onFocusProp?.();
    // Only open recents on genuine user focus (keyboard Tab, touch-tap from unfocused).
    // Programmatic .focus() calls (e.g. Vaul focus-restore) have isTrusted=false and
    // should not show the dropdown.
    if (e.nativeEvent.isTrusted) {
      openRecentsIfEligible();
    }
  }

  function handleInputClick() {
    // Covers the case where the input is already focused (no focus event fires on click).
    openRecentsIfEligible();
  }

  function handleBlur() {
    onBlurProp?.();
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
    const isShowingRecents = showRecents && !showSuggestions;
    const activeList = isShowingRecents ? (recentSearches ?? []) : suggestions;

    if (!showSuggestions && !showRecents) {
      if (e.key === "Enter") { e.preventDefault(); handleSubmit(); }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIdx((i) => Math.min(i + 1, activeList.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setShowRecents(false);
      setHighlightedIdx(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIdx >= 0) {
        if (isShowingRecents) {
          const recent = activeList[highlightedIdx] as string;
          setShowRecents(false);
          setHighlightedIdx(-1);
          onRecentSelect?.(recent);
        } else {
          selectSuggestion(suggestions[highlightedIdx]);
        }
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
  const isPill = variant === "pill";

  return (
    <div ref={containerRef} className="relative font-[family-name:var(--font-dm-sans)]">
      {/* Input row */}
      {isPill ? (
        // Pill variant — original map search bar style
        <div className="flex items-center gap-2 rounded-full border border-[#e0dbd0] bg-white px-4 py-2.5 shadow-md">
          <div className="min-w-0 flex-1">
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => handleChange(e.target.value)}
              onFocus={handleFocus}
              onClick={handleInputClick}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={loading}
              className="w-full bg-transparent text-sm outline-none disabled:opacity-60 placeholder:text-[#8a9e8a]"
              style={{ color: TEXT }}
            />
          </div>
          {/* Circular action button — × (clear) when value is set, search icon otherwise */}
          {onClear && value.trim() && !loading ? (
            <button
              onClick={() => { onChange(""); onClear(); }}
              aria-label="Clear search"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e8f0e8] transition-colors"
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M1 1l10 10M11 1L1 11" stroke="#5a7a5a" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!value.trim() || loading}
              aria-label="Search"
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-40 ${
                value.trim() ? "bg-[#e8674a]" : "bg-[#e8f0e8]"
              }`}
            >
              {loading ? (
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : (
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <circle cx="7" cy="7" r="5" stroke={value.trim() ? "#fff" : "#5a7a5a"} strokeWidth="1.8" />
                  <path d="M11 11l3 3" stroke={value.trim() ? "#fff" : "#5a7a5a"} strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              )}
            </button>
          )}
          {pillTrailing}
        </div>
      ) : (
        // Default variant — HomeScreen card style
        <div
          className="flex items-center gap-2 rounded-xl border bg-[#faf8f4] px-3 py-2.5 transition-colors duration-200"
          style={{ borderColor: focused || value ? FOREST_GREEN : BORDER }}
        >
          <span className="shrink-0 text-sm" style={{ color: SAGE }}>🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={handleFocus}
            onClick={handleInputClick}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={loading}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none disabled:opacity-60 placeholder:text-[#8a9e8a]"
            style={{ color: TEXT }}
          />
          <button
            onClick={handleSubmit}
            disabled={!value.trim() || loading}
            className="flex shrink-0 min-w-[56px] items-center justify-center gap-1.5 rounded-[8px] px-3 py-1.5 text-xs font-bold transition-colors disabled:cursor-not-allowed"
            style={
              value.trim()
                ? { backgroundColor: CORAL, color: "white" }
                : { backgroundColor: "#e8ddd4", color: TEXT_MUTED }
            }
          >
            {loading ? (
              <span className="inline-block h-[11px] w-[11px] animate-spin rounded-full border-2 border-white/35 border-t-white" />
            ) : (
              "Pitch"
            )}
          </button>
        </div>
      )}

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-2xl border bg-white shadow-[0_8px_24px_rgba(45,74,45,0.12)]" style={{ borderColor: BORDER }}>
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
                <span className="block truncate text-[13px] font-semibold" style={{ color: TEXT }}>
                  {s.name}
                </span>
                <span className="block truncate text-[11px]" style={{ color: SAGE }}>
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
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-2xl border bg-white shadow-[0_8px_24px_rgba(45,74,45,0.12)]" style={{ borderColor: BORDER }}>
          {recentSearches.map((recent, i) => (
            <button
              key={recent}
              onMouseDown={(e) => {
                e.preventDefault();
                setShowRecents(false);
                onRecentSelect?.(recent);
              }}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                i === highlightedIdx ? "bg-[#f0f5f0]" : "hover:bg-[#f7f5f0]"
              } ${
                i < recentSearches.length - 1 ? "border-b border-[#f0ede8]" : ""
              }`}
              style={{ color: TEXT }}
            >
              <span style={{ color: SAGE }}>🕐</span>
              <span className="flex-1 truncate">{recent}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

SearchInput.displayName = "SearchInput";
export default SearchInput;
