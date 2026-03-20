"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SEARCH_RESULTS_KEY, type SearchResultsPayload } from "@/lib/searchResults";

// Cycling placeholder prompts — matches prototype EXAMPLE_PROMPTS
const EXAMPLE_PROMPTS = [
  "Dog-friendly spot 2hrs from Sydney, dry this weekend",
  "Somewhere near Melbourne not raining Friday–Sunday",
  "Beach camping within 3hrs of Brisbane this weekend",
  "Quiet bush camp near Adelaide, no rain Saturday",
];

// Quick filter chips — matches prototype QUICK_FILTERS
const QUICK_CHIPS = [
  { key: "pitchd",  label: "Pitchd pick",  icon: "logo", query: "Best camping spots with great weather this weekend" },
  { key: "weather", label: "Good weather", icon: "☀️",   query: "Dry sunny camping this weekend" },
  { key: "dog",     label: "Dog friendly", icon: "🐕",   query: "Dog friendly camping this weekend" },
  { key: "fishing", label: "Fishing",      icon: "🎣",   query: "Camping with fishing this weekend" },
  { key: "hiking",  label: "Hiking",       icon: "🥾",   query: "Camping near excellent hiking trails this weekend" },
] as const;

// Loading messages — shown while search is in progress
const LOADING_MESSAGES = [
  "Parsing your query…",
  "Finding campsites…",
  "Almost there…",
];


// SVG scenic landscape illustration — ported from prototype ScenicPhoto (seed=2)
function ScenicPhoto() {
  const uid = useId();
  const skyId = `${uid}-sky`;
  const overlayId = `${uid}-overlay`;
  const w = 400;
  const h = 260;
  // Palette index 2 (seed=2 % 4 = 2): sandy sky, earthy hills
  const sky = "#c4a882";
  const hills = ["#8a6a4a", "#6b5a3a", "#4a3a2a"];
  const ground = "#7a6a4a";
  return (
    <svg
      width="100%"
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid slice"
      className="block"
    >
      <defs>
        <linearGradient id={skyId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={sky} stopOpacity="0.9" />
          <stop offset="100%" stopColor={sky} stopOpacity="0.4" />
        </linearGradient>
        <linearGradient id={overlayId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.35)" />
        </linearGradient>
      </defs>
      <rect width={w} height={h} fill={`url(#${skyId})`} />
      {/* Far hills */}
      <path
        d={`M0 ${h*0.65} Q${w*0.2} ${h*0.38} ${w*0.4} ${h*0.52} Q${w*0.6} ${h*0.35} ${w*0.8} ${h*0.48} Q${w*0.9} ${h*0.42} ${w} ${h*0.5} L${w} ${h} L0 ${h}Z`}
        fill={hills[0]} opacity="0.6"
      />
      {/* Mid hills */}
      <path
        d={`M0 ${h*0.72} Q${w*0.15} ${h*0.55} ${w*0.3} ${h*0.65} Q${w*0.5} ${h*0.48} ${w*0.65} ${h*0.62} Q${w*0.82} ${h*0.52} ${w} ${h*0.6} L${w} ${h} L0 ${h}Z`}
        fill={hills[1]}
      />
      {/* Foreground */}
      <path
        d={`M0 ${h*0.82} Q${w*0.25} ${h*0.7} ${w*0.5} ${h*0.78} Q${w*0.75} ${h*0.68} ${w} ${h*0.75} L${w} ${h} L0 ${h}Z`}
        fill={hills[2]}
      />
      {/* Ground strip */}
      <rect x="0" y={h*0.9} width={w} height={h*0.1} fill={ground} />
      {/* Tent silhouette */}
      <polygon
        points={`${w*0.45},${h*0.75} ${w*0.5},${h*0.63} ${w*0.55},${h*0.75}`}
        fill="rgba(255,255,255,0.85)"
      />
      <rect x={w*0.485} y={h*0.73} width={w*0.03} height={h*0.02} fill="rgba(255,255,255,0.5)" />
      {/* Overlay for text readability */}
      <rect width={w} height={h} fill={`url(#${overlayId})`} />
      {[...Array(12)].map((_, i) => (
        <circle
          key={i}
          cx={(i * 37 + 2 * 13) % w}
          cy={h * 0.3 + ((i * 17) % (h * 0.3))}
          r={1 + (i % 2)}
          fill="rgba(255,255,255,0.15)"
        />
      ))}
    </svg>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [promptIdx, setPromptIdx] = useState(0);

  // Cycle placeholder prompts every 3.2 s
  useEffect(() => {
    const t = setInterval(() => setPromptIdx((i) => (i + 1) % EXAMPLE_PROMPTS.length), 3200);
    return () => clearInterval(t);
  }, []);

  // Cycle loading message every 1.5 s while loading
  const loadingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (loading) {
      loadingIntervalRef.current = setInterval(
        () => setLoadingMsgIdx((i) => (i + 1) % LOADING_MESSAGES.length),
        1500,
      );
    } else {
      if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
      setLoadingMsgIdx(0);
    }
    return () => {
      if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
    };
  }, [loading]);

  async function handleSearch(q: string) {
    if (!q.trim() || loading) return;
    setError(null);
    setLoading(true);

    // Get user location; fall back to Sydney if denied
    let lat = -33.8688;
    let lng = 151.2093;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 }),
      );
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch {
      // Geolocation denied or unavailable — use Sydney default
    }

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q.trim(), lat, lng }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Search failed");
      }

      const data = (await res.json()) as Pick<SearchResultsPayload, "campsites" | "parsedIntent">;

      const payload: SearchResultsPayload = {
        campsites: data.campsites,
        parsedIntent: data.parsedIntent,
        query: q.trim(),
      };
      sessionStorage.setItem(SEARCH_RESULTS_KEY, JSON.stringify(payload));
      router.push("/map");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh bg-[#f7f5f0] font-[family-name:var(--font-dm-sans)] text-[#1a2e1a]">
      {/* Hero panel */}
      <div className="relative h-64 overflow-hidden">
        <div className="absolute inset-0">
          <ScenicPhoto />
        </div>
        {/* Gradient overlay — fades into page background */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-transparent to-[#f7f5f0]" />

        {/* Wordmark */}
        <div className="absolute left-5 top-12 flex items-baseline">
          <span className="font-[family-name:var(--font-lora)] text-2xl font-bold tracking-tight text-white drop-shadow-sm">
            Pitch
          </span>
          <span className="font-[family-name:var(--font-lora)] text-2xl font-bold tracking-tight text-[#f0a090] drop-shadow-sm">
            d
          </span>
        </div>
        <div className="absolute left-5 top-[4.75rem] text-[9px] font-medium uppercase tracking-[2px] text-white/75">
          AI Camping Companion
        </div>

        {/* Hero tagline */}
        <div className="absolute bottom-5 left-5 right-5">
          <p className="font-[family-name:var(--font-lora)] text-xl italic text-[#2d4a2d]">
            Find your perfect
            <br />
            camp in seconds.
          </p>
        </div>
      </div>

      {/* Search card */}
      <div className="relative z-10 -mt-2 px-4">
        <div className="mb-4 rounded-[20px] bg-white p-4 shadow-[0_4px_24px_rgba(45,74,45,0.15)]">
          {/* Textarea */}
          <div
            className="relative mb-2.5 rounded-xl border bg-[#faf8f4] transition-colors duration-200"
            style={{ borderColor: focused ? "#2d4a2d" : "#e0dbd0" }}
          >
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSearch(query);
                }
              }}
              rows={3}
              placeholder={EXAMPLE_PROMPTS[promptIdx]}
              disabled={loading}
              className="block w-full resize-none bg-transparent pb-10 pl-3.5 pr-3.5 pt-3.5 text-sm leading-[1.55] text-[#1a2e1a] outline-none placeholder:text-[#8a9e8a] disabled:opacity-60"
            />

            {/* Bottom bar inside textarea */}
            <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between">
              <span className="text-[10px] text-[#8a9e8a]">Try: &quot;not raining this weekend&quot;</span>
              <button
                onClick={() => void handleSearch(query)}
                disabled={!query.trim() || loading}
                className={`flex min-w-[60px] items-center justify-center gap-1.5 rounded-[10px] px-4 py-1.5 text-xs font-bold transition-colors duration-150 disabled:cursor-not-allowed ${query.trim() || loading ? "bg-[#e8674a] text-white" : "bg-[#e8ddd4] text-[#8a9e8a]"}`}
              >
                {loading ? (
                  <>
                    <span className="inline-block h-[11px] w-[11px] animate-spin rounded-full border-2 border-white/35 border-t-white" />
                    <span>Pitching</span>
                  </>
                ) : (
                  "Pitch"
                )}
              </button>
            </div>
          </div>

          {/* Quick filter chips */}
          <div className="flex gap-1.5 overflow-x-auto py-0.5 [scrollbar-width:none]">
            {QUICK_CHIPS.map((chip) => (
              <button
                key={chip.key}
                onClick={() => void handleSearch(chip.query)}
                disabled={loading}
                aria-label={chip.icon === "logo" ? chip.label : undefined}
                className="flex shrink-0 cursor-pointer items-center gap-1 rounded-full border border-[#e0dbd0] bg-white px-3 py-1.5 shadow-sm transition-all duration-150 hover:border-[#2d4a2d] hover:bg-[#2d4a2d] hover:text-white disabled:opacity-50 [&:hover_span]:text-white"
              >
                {chip.icon === "logo" ? (
                  <span className="flex items-baseline">
                    <span className="font-[family-name:var(--font-lora)] text-[11px] font-bold leading-none tracking-tight text-[#2d4a2d]">
                      Pitch
                    </span>
                    <span className="font-[family-name:var(--font-lora)] text-[11px] font-bold leading-none tracking-tight text-[#e8674a]">
                      d
                    </span>
                  </span>
                ) : (
                  <>
                    <span className="text-xs">{chip.icon}</span>
                    <span className="whitespace-nowrap text-[11px] font-semibold text-[#1a2e1a]">
                      {chip.label}
                    </span>
                  </>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 rounded-xl border border-[#fdd] bg-white px-4 py-3 text-sm text-[#e8674a]">
            {error}
          </div>
        )}

        {/* Loading progress bar */}
        {loading && (
          <div className="pb-8 pt-2">
            <p className="mb-2.5 text-center text-[11px] text-[#8a9e8a]">
              {LOADING_MESSAGES[loadingMsgIdx]}
            </p>
            <div className="mx-auto h-0.5 w-12 overflow-hidden rounded-sm bg-[#eeeae2]">
              <div className="h-full animate-[ldprogress_1.8s_ease-in-out_infinite] rounded-sm bg-[#2d4a2d]" />
            </div>
          </div>
        )}

        {/* Suggested prompts */}
        {!loading && (
          <div className="mb-8">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[1.8px] text-[#8a9e8a]">
              Suggested
            </p>
            {EXAMPLE_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => setQuery(p)}
                className="mb-1.5 flex w-full items-center gap-2.5 rounded-xl border border-[#e0dbd0] bg-white px-3.5 py-3 text-left shadow-sm"
              >
                <span className="text-[13px] text-[#7a9e7a]">↗</span>
                <span className="text-xs leading-snug text-[#4a6a4a]">{p}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
