import { useState, useEffect, useRef } from "react";
import React from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";

function MapController({ bounds, cityKey, controlRef }) {
  const map = useMap();
  useEffect(() => {
    controlRef.current = map;
  }, [map]);
  useEffect(() => {
    if (bounds.length) map.fitBounds(bounds, { padding: [50, 50] });
  }, [cityKey, bounds.length]);
  return null;
}

// ── Google Fonts ──────────────────────────────────────────────────────────────
const FONTS = `@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,300&display=swap');`;

// ── Design tokens — light / nature theme ─────────────────────────────────────
const C = {
  bg: "#f7f5f0", // warm off-white
  bgAlt: "#eeeae2", // slightly deeper warm white
  surface: "#ffffff",
  surfaceWarm: "#faf8f4",
  forest: "#2d4a2d", // deep forest green — headings
  forestMid: "#3d6b3d", // mid green — secondary headings
  sage: "#7a9e7a", // sage green — secondary text
  sagePale: "#e8f0e8", // very pale green — bg accents
  coral: "#e8674a", // primary CTA — coral/terra
  coralLight: "#fdf0ed", // coral tint
  coralMid: "#f0a090", // coral mid
  sand: "#c8a882", // warm sand accent
  text: "#1a2e1a", // near-black with green tint
  textMid: "#4a6a4a", // mid text
  textMuted: "#8a9e8a", // muted text
  border: "#e0dbd0", // warm border
  borderLight: "#ede9e0",
  shadow: "rgba(45,74,45,0.10)",
  shadowMd: "rgba(45,74,45,0.15)",
  shadowLg: "rgba(45,74,45,0.22)",
  good: "#4a9e6a", // green — good weather
  warn: "#c8a040", // amber — ok weather
  bad: "#e8674a", // coral — poor weather
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const CITIES = [
  { key: "sydney", label: "Sydney", lat: -33.87, lng: 151.21 },
  { key: "melbourne", label: "Melbourne", lat: -37.81, lng: 144.96 },
  { key: "brisbane", label: "Brisbane", lat: -27.47, lng: 153.02 },
  { key: "perth", label: "Perth", lat: -31.95, lng: 115.86 },
  { key: "adelaide", label: "Adelaide", lat: -34.93, lng: 138.6 },
];

const EXAMPLE_PROMPTS = [
  "Dog-friendly spot 2hrs from Sydney, dry this weekend",
  "Somewhere near Melbourne not raining Friday–Sunday",
  "Beach camping within 3hrs of Brisbane this weekend",
  "Quiet bush camp near Adelaide, no rain Saturday",
];

const CAMPING_AREAS = {
  sydney: [
    {
      name: "Blue Mountains",
      blurb: "Sandstone valleys, waterfalls & epic bushwalks",
      lat: -33.7167,
      lng: 150.3167,
      driveHrs: 1.5,
      tags: ["hiking", "dog"],
    },
    {
      name: "Royal National Park",
      blurb: "Coastal cliffs, beaches & ancient bushland",
      lat: -34.0833,
      lng: 151.05,
      driveHrs: 1.0,
      tags: ["hiking", "dog", "fishing"],
    },
    {
      name: "Ku-ring-gai Chase NP",
      blurb: "Pittwater views, Aboriginal art & secluded bays",
      lat: -33.6167,
      lng: 151.2,
      driveHrs: 0.75,
      tags: ["hiking", "fishing"],
    },
    {
      name: "Kangaroo Valley",
      blurb: "Lush river valley, swimming holes & towering gorges",
      lat: -34.7333,
      lng: 150.5167,
      driveHrs: 2.0,
      tags: ["hiking", "dog", "fishing"],
    },
    {
      name: "Hunter Valley",
      blurb: "Rolling wine country with riverside camp spots",
      lat: -32.8333,
      lng: 151.3,
      driveHrs: 2.0,
      tags: ["dog", "fishing"],
    },
    {
      name: "Jervis Bay",
      blurb: "Whitest sand beaches & crystal clear water",
      lat: -35.1,
      lng: 150.7667,
      driveHrs: 2.5,
      tags: ["dog", "fishing"],
    },
    {
      name: "Barrington Tops",
      blurb: "Rainforest plateau, cool air & ancient trees",
      lat: -31.9667,
      lng: 151.4833,
      driveHrs: 3.0,
      tags: ["hiking", "dog"],
    },
    {
      name: "Myall Lakes NP",
      blurb: "Stunning coastal lakes & untouched beaches",
      lat: -32.4333,
      lng: 152.35,
      driveHrs: 3.0,
      tags: ["fishing", "dog"],
    },
  ],
  melbourne: [
    {
      name: "Grampians NP",
      blurb: "Sandstone peaks, wildflowers & Aboriginal art",
      lat: -37.1333,
      lng: 142.5167,
      driveHrs: 3.0,
      tags: ["hiking", "dog"],
    },
    {
      name: "Wilson's Promontory",
      blurb: "Victoria's southernmost tip — rugged coastal wilderness",
      lat: -39.05,
      lng: 146.3833,
      driveHrs: 3.0,
      tags: ["hiking"],
    },
    {
      name: "Yarra Ranges",
      blurb: "Mountain ash forests & lush fern gullies",
      lat: -37.75,
      lng: 145.7,
      driveHrs: 1.25,
      tags: ["hiking", "dog"],
    },
    {
      name: "Great Otway NP",
      blurb: "Waterfalls, rainforest & stunning Great Ocean Road",
      lat: -38.55,
      lng: 143.9833,
      driveHrs: 2.0,
      tags: ["hiking", "dog"],
    },
    {
      name: "Lake Eildon NP",
      blurb: "Huge reservoir ringed by forested bush camping",
      lat: -37.1167,
      lng: 145.9167,
      driveHrs: 2.0,
      tags: ["fishing", "dog"],
    },
    {
      name: "Mornington Peninsula NP",
      blurb: "Ocean beaches, hot springs & coastal bushwalks",
      lat: -38.5,
      lng: 144.8,
      driveHrs: 1.5,
      tags: ["dog", "hiking"],
    },
  ],
  brisbane: [
    {
      name: "Lamington NP",
      blurb: "Ancient volcanic rainforest on the plateau rim",
      lat: -28.2167,
      lng: 153.1333,
      driveHrs: 1.5,
      tags: ["hiking"],
    },
    {
      name: "Moreton Island NP",
      blurb: "Sand dunes, shipwrecks & crystal clear camping bays",
      lat: -27.1,
      lng: 153.4,
      driveHrs: 1.5,
      tags: ["dog", "fishing"],
    },
    {
      name: "Girraween NP",
      blurb: "Huge granite boulders & wildflower meadows",
      lat: -28.8333,
      lng: 151.95,
      driveHrs: 2.5,
      tags: ["hiking", "dog"],
    },
    {
      name: "D'Aguilar NP",
      blurb: "Brisbane's backyard bush escape with great trails",
      lat: -27.2333,
      lng: 152.7333,
      driveHrs: 0.5,
      tags: ["hiking", "dog"],
    },
    {
      name: "Glass House Mountains",
      blurb: "Volcanic plugs rising from coastal plains",
      lat: -26.9,
      lng: 152.95,
      driveHrs: 1.0,
      tags: ["hiking"],
    },
    {
      name: "Sunshine Coast Hinterland",
      blurb: "Rainforest waterfalls, lakes & glowworms",
      lat: -26.5833,
      lng: 152.7,
      driveHrs: 1.25,
      tags: ["hiking", "dog"],
    },
  ],
  perth: [
    {
      name: "Margaret River",
      blurb: "Karri forests, sea caves & world-class surf",
      lat: -33.9533,
      lng: 115.0733,
      driveHrs: 3.0,
      tags: ["hiking", "dog", "fishing"],
    },
    {
      name: "Lane Poole Reserve",
      blurb: "Jarrah forest & gentle rapids for canoe camping",
      lat: -32.7167,
      lng: 116.0667,
      driveHrs: 1.25,
      tags: ["hiking", "fishing", "dog"],
    },
    {
      name: "John Forrest NP",
      blurb: "Perth's oldest park with waterfalls & wildflowers",
      lat: -31.8667,
      lng: 116.0833,
      driveHrs: 0.5,
      tags: ["hiking", "dog"],
    },
    {
      name: "Wellington NP",
      blurb: "Collie River gorge, swimming holes & tall timber",
      lat: -33.2167,
      lng: 116.05,
      driveHrs: 2.5,
      tags: ["hiking", "fishing"],
    },
    {
      name: "Leeuwin-Naturaliste NP",
      blurb: "Dramatic capes, sea caves & Margaret River coast",
      lat: -33.8667,
      lng: 115.0167,
      driveHrs: 3.0,
      tags: ["hiking", "dog"],
    },
    {
      name: "Yanchep NP",
      blurb: "Tuart forest, koalas & coastal limestone caves",
      lat: -31.5483,
      lng: 115.6767,
      driveHrs: 0.75,
      tags: ["hiking", "dog"],
    },
  ],
  adelaide: [
    {
      name: "Deep Creek NP",
      blurb: "Rugged Fleurieu cliffs, whale watching & coastal hikes",
      lat: -35.6,
      lng: 138.32,
      driveHrs: 1.5,
      tags: ["hiking", "dog"],
    },
    {
      name: "Coorong NP",
      blurb: "Vast coastal lagoon with birdlife, dunes & fishing",
      lat: -35.83,
      lng: 139.2,
      driveHrs: 1.5,
      tags: ["fishing", "dog"],
    },
    {
      name: "Belair NP",
      blurb: "Adelaide's oldest park with wildlife & bush camping",
      lat: -35.02,
      lng: 138.63,
      driveHrs: 0.25,
      tags: ["hiking", "dog"],
    },
    {
      name: "Innes NP",
      blurb: "Dramatic southern cliffs, surf & historic ghost town",
      lat: -35.23,
      lng: 136.9,
      driveHrs: 3.0,
      tags: ["hiking", "fishing"],
    },
    {
      name: "Mount Lofty Ranges",
      blurb: "Cool Adelaide Hills summit & bush camping",
      lat: -35.0,
      lng: 138.7,
      driveHrs: 0.5,
      tags: ["hiking", "dog"],
    },
    {
      name: "Barossa Valley",
      blurb: "World-famous wine region with cellar door camping",
      lat: -34.52,
      lng: 138.95,
      driveHrs: 1.0,
      tags: ["dog"],
    },
  ],
};

const AMENITY_POIS = {
  dump: {
    sydney: [
      {
        name: "Wisemans Ferry Dump Station",
        blurb: "Free RV dump, open 24hr · coin water rinse",
        driveHrs: 1.5,
        dLat: 0.42,
        dLng: -0.28,
      },
      {
        name: "Campbelltown Council Dump",
        blurb: "Free council dump · no booking required",
        driveHrs: 0.75,
        dLat: 0.2,
        dLng: -0.38,
      },
      {
        name: "Gosford Caravan Park Dump",
        blurb: "Dump + water rinse · visitors welcome",
        driveHrs: 1.0,
        dLat: -0.5,
        dLng: 0.24,
      },
    ],
    melbourne: [
      {
        name: "Mornington Dump Station",
        blurb: "Free council dump · open daily 7am–7pm",
        driveHrs: 1.5,
        dLat: 0.67,
        dLng: 0.38,
      },
      {
        name: "Healesville Dump Point",
        blurb: "Yarra Ranges gateway · free dump, potable water",
        driveHrs: 1.25,
        dLat: -0.3,
        dLng: 0.5,
      },
    ],
    brisbane: [
      {
        name: "Caboolture Dump Station",
        blurb: "Free dump · Sunshine Coast gateway · 24hr",
        driveHrs: 0.75,
        dLat: -0.55,
        dLng: 0.08,
      },
    ],
    perth: [
      {
        name: "Mundaring Dump Station",
        blurb: "Hills gateway · free 24hr dump point",
        driveHrs: 0.75,
        dLat: -0.05,
        dLng: 0.42,
      },
    ],
    adelaide: [
      {
        name: "Hahndorf Dump Station",
        blurb: "Adelaide Hills entry · free 24hr dump",
        driveHrs: 0.5,
        dLat: 0.12,
        dLng: 0.22,
      },
    ],
  },
  water: {
    sydney: [
      {
        name: "Katoomba Water Fill",
        blurb: "Blue Mountains gateway · potable, open 24hr",
        driveHrs: 1.5,
        dLat: 0.2,
        dLng: -0.88,
      },
      {
        name: "Richmond Recreation Reserve",
        blurb: "Free water fill · near Hawkesbury River",
        driveHrs: 1.0,
        dLat: 0.04,
        dLng: -0.28,
      },
    ],
    melbourne: [
      {
        name: "Lilydale Water Fill",
        blurb: "Yarra Valley gateway · potable 24hr",
        driveHrs: 0.75,
        dLat: -0.22,
        dLng: 0.42,
      },
    ],
    brisbane: [
      {
        name: "Toowoomba Water Station",
        blurb: "Darling Downs gateway · free council fill",
        driveHrs: 1.5,
        dLat: 0.35,
        dLng: -0.72,
      },
    ],
    perth: [
      {
        name: "Mundaring Water Fill",
        blurb: "Perth Hills · potable water, open 24hr",
        driveHrs: 0.75,
        dLat: -0.02,
        dLng: 0.45,
      },
    ],
    adelaide: [
      {
        name: "Hahndorf Water Fill",
        blurb: "Adelaide Hills · potable tank fill, free",
        driveHrs: 0.5,
        dLat: 0.15,
        dLng: 0.25,
      },
    ],
  },
};

const AMENITY_META = {
  dump: {
    icon: "🚐",
    color: "#c8870a",
    label: "Dump point",
    typeLabel: "Dump Station",
  },
  water: {
    icon: "💧",
    color: "#2a8ab0",
    label: "Water fill",
    typeLabel: "Water Fill",
  },
};

const TAG_META = {
  dog: { icon: "🐕", label: "Dog friendly", color: "#b85a20" },
  fishing: { icon: "🎣", label: "Fishing", color: "#2a6eb0" },
  hiking: { icon: "🥾", label: "Hiking", color: "#5a6ab0" },
};

const QUICK_FILTERS = [
  {
    key: "pitchd",
    label: "Pitchd pick",
    icon: "logo",
    ai: true,
    mode: "campsite",
    query: (city, hrs) =>
      `Best camping spots with great weather near ${city} this weekend within ${hrs}hr drive`,
  },
  {
    key: "weather",
    label: "Good weather",
    icon: "☀️",
    mode: "campsite",
    query: (city) => `Dry sunny camping near ${city} this weekend`,
  },
  {
    key: "dog",
    label: "Dog friendly",
    icon: "🐕",
    mode: "campsite",
    query: (city) => `Dog friendly camping near ${city} this weekend`,
  },
  {
    key: "fishing",
    label: "Fishing",
    icon: "🎣",
    mode: "campsite",
    query: (city) => `Camping with fishing near ${city} this weekend`,
  },
  {
    key: "hiking",
    label: "Hiking",
    icon: "🥾",
    mode: "campsite",
    query: (city) =>
      `Camping near excellent hiking trails near ${city} this weekend`,
  },
  {
    key: "dump",
    label: "Dump points",
    icon: "🚐",
    mode: "amenity",
    amenityType: "dump",
  },
  {
    key: "water",
    label: "Water fill",
    icon: "💧",
    mode: "amenity",
    amenityType: "water",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function driveLabel(h) {
  return h < 1
    ? `${Math.round(h * 60)}min`
    : h === Math.floor(h)
      ? `${h}hr`
      : `${h}hr`;
}
function getIcon(c = "") {
  const l = c.toLowerCase();
  if (l.includes("storm")) return "⛈️";
  if (l.includes("heavy rain")) return "🌧️";
  if (l.includes("rain") || l.includes("shower")) return "🌦️";
  if (l.includes("overcast")) return "☁️";
  if (l.includes("cloud")) return "⛅";
  return "☀️";
}
function scoreRegion(days = []) {
  let s = 100;
  days.forEach((d) => {
    const c = (d.condition || "").toLowerCase(),
      p = d.rainChance || 0;
    if (c.includes("storm")) s -= 28;
    else if (c.includes("heavy rain")) s -= 22;
    else if (c.includes("rain")) s -= 16;
    else if (c.includes("shower")) s -= 10;
    else if (c.includes("overcast")) s -= 4;
    else if (c.includes("cloud")) s -= 2;
    if (p >= 70) s -= 8;
    else if (p >= 50) s -= 4;
    else if (p >= 30) s -= 2;
  });
  return Math.max(0, Math.min(100, s));
}
function getBadge(score) {
  if (score >= 75)
    return { label: "Great", color: C.good, bg: "#e8f5ee", dot: "#4a9e6a" };
  if (score >= 45)
    return { label: "Good", color: C.warn, bg: "#fdf5e0", dot: "#c8a040" };
  return { label: "Poor", color: C.bad, bg: "#fdf0ed", dot: "#e8674a" };
}
function condColor(c = "") {
  const l = c.toLowerCase();
  if (l.includes("storm") || l.includes("heavy rain")) return C.bad;
  if (l.includes("rain")) return "#e09060";
  if (l.includes("shower")) return C.warn;
  if (l.includes("overcast") || l.includes("cloud")) return "#90a890";
  return C.good;
}

// ── API ───────────────────────────────────────────────────────────────────────
async function parseNL(query) {
  const today = isoDate(new Date());
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 200,
      system: "JSON-only. No other text.",
      messages: [
        {
          role: "user",
          content: `Parse camping search: "${query}"\nToday: ${today}\nReturn ONLY: {"city":"sydney","driveHrs":3,"dateFrom":null,"dateTo":null}\ncity: sydney/melbourne/brisbane/perth/adelaide. driveHrs: 1,2,3. "this weekend"=upcoming Sat+Sun.`,
        },
      ],
    }),
  });
  const data = await res.json();
  const t = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  const s = t.indexOf("{"),
    e = t.lastIndexOf("}");
  if (s === -1) throw new Error("parse fail");
  return JSON.parse(t.slice(s, e + 1));
}

async function fetchBatch(areas, dateList, cityLabel) {
  // Mock weather data for prototype capture — no API key required
  const MOCK_WEATHER = [
    {
      condition: "Sunny",
      hi: 26,
      lo: 14,
      rainChance: 5,
      rainMm: 0,
      summary:
        "Clear skies and warm sunshine — perfect camping weather all weekend.",
    },
    {
      condition: "Partly Cloudy",
      hi: 24,
      lo: 13,
      rainChance: 15,
      rainMm: 0,
      summary:
        "Mostly sunny with a few clouds drifting through. Great conditions.",
    },
    {
      condition: "Partly Cloudy",
      hi: 22,
      lo: 12,
      rainChance: 20,
      rainMm: 0,
      summary:
        "Pleasant and mild with some cloud cover. Comfortable overnight.",
    },
    {
      condition: "Sunny",
      hi: 28,
      lo: 15,
      rainChance: 5,
      rainMm: 0,
      summary: "Excellent conditions — sunny, warm and dry all weekend.",
    },
    {
      condition: "Light Showers",
      hi: 19,
      lo: 11,
      rainChance: 55,
      rainMm: 4,
      summary:
        "Some light showers likely Saturday morning, clearing by afternoon.",
    },
    {
      condition: "Cloudy",
      hi: 18,
      lo: 10,
      rainChance: 35,
      rainMm: 1,
      summary: "Overcast and cool but dry. Pack a layer for the evenings.",
    },
    {
      condition: "Partly Cloudy",
      hi: 23,
      lo: 13,
      rainChance: 10,
      rainMm: 0,
      summary: "Largely sunny with a pleasant sea breeze. Good beach weather.",
    },
    {
      condition: "Sunny",
      hi: 25,
      lo: 14,
      rainChance: 5,
      rainMm: 0,
      summary: "Brilliant weekend ahead — plenty of sunshine and clear skies.",
    },
  ];
  const D = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return areas.map((area, i) => {
    const w = MOCK_WEATHER[i % MOCK_WEATHER.length];
    const days = dateList.map((dl) => {
      const dateStr = dl.split(" ")[0];
      const dow = new Date(dateStr + "T00:00:00").getDay();
      return {
        date: dateStr,
        dayName: D[dow],
        condition: w.condition,
        hi: w.hi + Math.round((i % 3) - 1),
        lo: w.lo,
        rainChance: w.rainChance,
        rainMm: w.rainMm,
      };
    });
    return { name: area.name, days, summary: w.summary };
  });
}

async function fetchWeather(areas, from, to, cityLabel) {
  const dateList = [],
    cur = new Date(from + "T00:00:00"),
    end = new Date(to + "T00:00:00");
  const D = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  while (cur <= end) {
    dateList.push(`${isoDate(cur)} (${D[cur.getDay()]})`);
    cur.setDate(cur.getDate() + 1);
  }
  const results = [];
  for (let i = 0; i < areas.length; i += 8)
    results.push(
      ...(await fetchBatch(areas.slice(i, i + 8), dateList, cityLabel)),
    );
  return results;
}

// ── Activity tags ─────────────────────────────────────────────────────────────
function ActivityTags({ tags = [] }) {
  if (!tags?.length) return null;
  return (
    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
      {tags.map((tag) => {
        const m = TAG_META[tag];
        if (!m) return null;
        return (
          <span
            key={tag}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              fontSize: 10,
              fontWeight: 600,
              color: m.color,
              background: m.color + "15",
              border: `1px solid ${m.color}30`,
              borderRadius: 100,
              padding: "3px 8px",
            }}
          >
            <span style={{ fontSize: 11 }}>{m.icon}</span>
            {m.label}
          </span>
        );
      })}
    </div>
  );
}

// ── Weather strip ─────────────────────────────────────────────────────────────
function WeatherStrip({ days }) {
  if (!days?.length) return null;
  return (
    <div
      style={{
        display: "flex",
        gap: 2,
        borderRadius: 6,
        overflow: "hidden",
        height: 5,
        marginBottom: 10,
      }}
    >
      {days.map((d, i) => (
        <div key={i} style={{ flex: 1, background: condColor(d.condition) }} />
      ))}
    </div>
  );
}

// ── Scenic photo placeholder (SVG landscape) ──────────────────────────────────
function ScenicPhoto({ seed = 0, height = 180, style = {} }) {
  const palettes = [
    {
      sky: "#87CEAB",
      hills: ["#4a7c4a", "#5a9a5a", "#3d6b3d"],
      ground: "#6b8f4a",
    },
    {
      sky: "#7ab5d4",
      hills: ["#3d6b6b", "#4a8a7a", "#2d5a5a"],
      ground: "#5a7a5a",
    },
    {
      sky: "#c4a882",
      hills: ["#8a6a4a", "#6b5a3a", "#4a3a2a"],
      ground: "#7a6a4a",
    },
    {
      sky: "#b0c8a0",
      hills: ["#4a6a3a", "#3a5a2a", "#5a7a4a"],
      ground: "#6a8a4a",
    },
  ];
  const p = palettes[seed % palettes.length];
  const w = 400,
    h = height;
  return (
    <svg
      width="100%"
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid slice"
      style={{ display: "block", ...style }}
    >
      {/* Sky */}
      <defs>
        <linearGradient id={`sky${seed}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p.sky} stopOpacity="0.9" />
          <stop offset="100%" stopColor={p.sky} stopOpacity="0.4" />
        </linearGradient>
        <linearGradient id={`overlay${seed}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.35)" />
        </linearGradient>
      </defs>
      <rect width={w} height={h} fill={`url(#sky${seed})`} />
      {/* Far hills */}
      <path
        d={`M0 ${h * 0.65} Q${w * 0.2} ${h * 0.38} ${w * 0.4} ${h * 0.52} Q${w * 0.6} ${h * 0.35} ${w * 0.8} ${h * 0.48} Q${w * 0.9} ${h * 0.42} ${w} ${h * 0.5} L${w} ${h} L0 ${h}Z`}
        fill={p.hills[0]}
        opacity="0.6"
      />
      {/* Mid hills */}
      <path
        d={`M0 ${h * 0.72} Q${w * 0.15} ${h * 0.55} ${w * 0.3} ${h * 0.65} Q${w * 0.5} ${h * 0.48} ${w * 0.65} ${h * 0.62} Q${w * 0.82} ${h * 0.52} ${w} ${h * 0.6} L${w} ${h} L0 ${h}Z`}
        fill={p.hills[1]}
      />
      {/* Foreground */}
      <path
        d={`M0 ${h * 0.82} Q${w * 0.25} ${h * 0.7} ${w * 0.5} ${h * 0.78} Q${w * 0.75} ${h * 0.68} ${w} ${h * 0.75} L${w} ${h} L0 ${h}Z`}
        fill={p.hills[2]}
      />
      {/* Ground */}
      <rect x="0" y={h * 0.9} width={w} height={h * 0.1} fill={p.ground} />
      {/* Tent silhouette */}
      <polygon
        points={`${w * 0.45},${h * 0.75} ${w * 0.5},${h * 0.63} ${w * 0.55},${h * 0.75}`}
        fill="rgba(255,255,255,0.85)"
      />
      <rect
        x={w * 0.485}
        y={h * 0.73}
        width={w * 0.03}
        height={h * 0.02}
        fill="rgba(255,255,255,0.5)"
      />
      {/* Overlay for card readability */}
      <rect width={w} height={h} fill={`url(#overlay${seed})`} />
      {/* Subtle texture dots */}
      {[...Array(12)].map((_, i) => (
        <circle
          key={i}
          cx={(i * 37 + seed * 13) % w}
          cy={h * 0.3 + ((i * 17) % (h * 0.3))}
          r={1 + (i % 2)}
          fill="rgba(255,255,255,0.15)"
        />
      ))}
    </svg>
  );
}

// ── Quick filter chips ────────────────────────────────────────────────────────
function QuickFilterChips({ activeChip, onChip, style = {} }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 7,
        overflowX: "auto",
        padding: "8px 0 4px",
        scrollbarWidth: "none",
        WebkitOverflowScrolling: "touch",
        ...style,
      }}
    >
      {QUICK_FILTERS.map((chip) => {
        const isActive = activeChip === chip.key;
        return (
          <div
            key={chip.key}
            onClick={() => onChip(chip)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              flexShrink: 0,
              background: isActive ? (chip.ai ? C.coral : C.forest) : C.surface,
              border: `1.5px solid ${isActive ? (chip.ai ? C.coral : C.forest) : C.border}`,
              borderRadius: 100,
              padding: "6px 13px",
              cursor: "pointer",
              boxShadow: isActive ? "none" : `0 1px 4px ${C.shadow}`,
              transition: "all 0.15s",
            }}
          >
            {chip.icon === "logo" ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "baseline",
                  gap: 0,
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: isActive ? "#fff" : C.forest,
                    fontFamily: "'DM Serif Display', Georgia, serif",
                    lineHeight: 1,
                    letterSpacing: -0.3,
                  }}
                >
                  Pitch
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: isActive ? "rgba(255,255,255,0.75)" : C.coral,
                    fontFamily: "'DM Serif Display', Georgia, serif",
                    lineHeight: 1,
                    letterSpacing: -0.3,
                  }}
                >
                  d
                </span>
              </span>
            ) : (
              <span style={{ fontSize: 12 }}>{chip.icon}</span>
            )}
            {chip.icon !== "logo" && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: isActive ? "#fff" : chip.ai ? C.coral : C.text,
                  whiteSpace: "nowrap",
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                }}
              >
                {chip.label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Search bar ────────────────────────────────────────────────────────────────
function SearchBar({ searchState, onSearch, onEdit }) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const city = CITIES.find((c) => c.key === searchState?.cityKey);
  const d0 = searchState?.d0,
    d1 = searchState?.d1;
  const hasContext = city && d0 && d1;
  const contextLabel = hasContext
    ? `${city.label} · ${driveLabel(searchState.driveHrs)} · ${DAYS[d0.getDay()]} ${d0.getDate()} ${MONTHS[d0.getMonth()]} – ${DAYS[d1.getDay()]} ${d1.getDate()} ${MONTHS[d1.getMonth()]}`
    : null;
  function handleSubmit() {
    if (query.trim() && onSearch) {
      onSearch(query.trim());
      setQuery("");
    }
  }
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: C.surface,
        border: `1.5px solid ${focused ? C.forest : C.border}`,
        borderRadius: 100,
        padding: "9px 9px 9px 16px",
        boxShadow: focused ? `0 0 0 3px ${C.forest}22, 0 2px 12px ${C.shadow}` : `0 2px 12px ${C.shadow}`,
        transition: "border-color 0.2s, box-shadow 0.2s",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder={
            hasContext ? "New search…" : "Dog-friendly, 2hrs from Sydney…"
          }
          style={{
            width: "100%",
            background: "transparent",
            border: "none",
            outline: "none",
            fontSize: 13,
            color: C.text,
            fontFamily: "inherit",
            padding: 0,
          }}
        />
        {contextLabel && (
          <div
            style={{
              fontSize: 10,
              color: focused ? C.sage : C.textMuted,
              marginTop: 1,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              transition: "color 0.2s",
            }}
          >
            {contextLabel}
          </div>
        )}
      </div>
      <div
        onClick={handleSubmit}
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: query.trim() ? C.coral : C.sagePale,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: query.trim() ? "pointer" : "default",
          flexShrink: 0,
          transition: "background 0.15s",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <circle
            cx="7"
            cy="7"
            r="5"
            stroke={query.trim() ? "#fff" : C.sage}
            strokeWidth="1.8"
          />
          <path
            d="M11 11l3 3"
            stroke={query.trim() ? "#fff" : C.sage}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div
        style={{ width: 1, height: 18, background: C.border, flexShrink: 0 }}
      />
      <button
        onClick={onEdit}
        style={{
          background: "transparent",
          border: "none",
          padding: "4px 10px 4px 6px",
          fontSize: 12,
          color: C.coral,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "inherit",
          whiteSpace: "nowrap",
        }}
      >
        Filters
      </button>
    </div>
  );
}

// ── Home screen ───────────────────────────────────────────────────────────────
function HomeScreen({
  onSearch,
  onAmenity,
  loading,
  loadingMsg,
  recentSearches = [],
  onGoToMap,
  hasResults,
}) {
  const [query, setQuery] = useState("");
  const [promptIdx, setPromptIdx] = useState(0);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    const t = setInterval(
      () => setPromptIdx((i) => (i + 1) % EXAMPLE_PROMPTS.length),
      3200,
    );
    return () => clearInterval(t);
  }, []);
  function handleSubmit() {
    if (query.trim()) onSearch(query.trim());
  }

  const touchStart = useRef(null);
  function handleTouchStart(e) {
    touchStart.current = e.touches[0].clientX;
  }
  function handleTouchEnd(e) {
    if (!touchStart.current) return;
    const dx = touchStart.current - e.changedTouches[0].clientX;
    if (dx > 60 && hasResults && onGoToMap) onGoToMap();
    touchStart.current = null;
  }

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        height: "100%",
        background: C.bg,
        fontFamily: "'DM Serif Display', Georgia, serif",
        color: C.text,
        position: "relative",
        overflowY: "auto",
      }}
    >
      <style>{FONTS}</style>
      {/* Top hero photo panel */}
      <div style={{ position: "relative", height: 260, overflow: "hidden" }}>
        <ScenicPhoto seed={2} height={260} />
        {/* Overlay gradient */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0) 50%, rgba(247,245,240,0.9) 85%, rgba(247,245,240,1) 100%)",
          }}
        />
        {/* Logo in top left */}
        <div
          style={{
            position: "absolute",
            top: 48,
            left: 22,
            display: "flex",
            alignItems: "baseline",
            gap: 0,
          }}
        >
          <span
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: "#fff",
              letterSpacing: -0.5,
              textShadow: "0 1px 8px rgba(0,0,0,0.3)",
              fontFamily: "'DM Serif Display', Georgia, serif",
            }}
          >
            Pitch
          </span>
          <span
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: C.coralMid,
              letterSpacing: -0.5,
              textShadow: "0 1px 8px rgba(0,0,0,0.3)",
              fontFamily: "'DM Serif Display', Georgia, serif",
            }}
          >
            d
          </span>
        </div>
        <div
          style={{
            position: "absolute",
            top: 78,
            left: 22,
            fontSize: 9,
            color: "rgba(255,255,255,0.75)",
            letterSpacing: 2,
            textTransform: "uppercase",
            fontFamily: "'DM Sans', system-ui, sans-serif",
            fontWeight: 500,
          }}
        >
          AI Camping Companion
        </div>
        {/* Hero text over photo bottom */}
        <div style={{ position: "absolute", bottom: 20, left: 22, right: 22 }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 400,
              fontStyle: "italic",
              color: C.forest,
              lineHeight: 1.25,
              fontFamily: "'DM Serif Display', Georgia, serif",
            }}
          >
            Find your perfect
            <br />
            camp in seconds.
          </div>
        </div>
        {/* Swipe hint — only when results exist */}
        {hasResults && (
          <div
            style={{
              position: "absolute",
              right: 14,
              top: "50%",
              transform: "translateY(-50%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              opacity: 0.7,
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,0.8)",
                fontFamily: "'DM Sans', system-ui, sans-serif",
                fontWeight: 600,
                writingMode: "vertical-rl",
                letterSpacing: 1,
              }}
            >
              Map
            </div>
            <div style={{ fontSize: 16, color: "rgba(255,255,255,0.8)" }}>
              ›
            </div>
          </div>
        )}
      </div>

      {/* Search card — floats below hero */}
      <div
        style={{
          padding: "0 16px",
          marginTop: -8,
          position: "relative",
          zIndex: 10,
        }}
      >
        <div
          style={{
            background: C.surface,
            borderRadius: 20,
            boxShadow: `0 4px 24px ${C.shadowMd}`,
            padding: 16,
            marginBottom: 16,
          }}
        >
          {/* Textarea */}
          <div
            style={{
              position: "relative",
              borderRadius: 12,
              border: `1.5px solid ${focused ? C.forest : C.border}`,
              background: C.surfaceWarm,
              marginBottom: 10,
              transition: "border-color 0.2s",
            }}
          >
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              rows={3}
              placeholder={EXAMPLE_PROMPTS[promptIdx]}
              style={{
                width: "100%",
                boxSizing: "border-box",
                background: "transparent",
                border: "none",
                padding: "13px 13px 42px",
                fontSize: 14,
                color: C.text,
                fontFamily: "'DM Serif Display', Georgia, serif",
                outline: "none",
                resize: "none",
                lineHeight: 1.55,
                display: "block",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: 9,
                right: 9,
                left: 9,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  color: C.textMuted,
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                }}
              >
                Try: "not raining this weekend"
              </span>
              <button
                onClick={handleSubmit}
                disabled={!query.trim() || loading}
                style={{
                  background: query.trim() || loading ? C.coral : "#e8ddd4",
                  color: query.trim() || loading ? "#fff" : C.textMuted,
                  border: "none",
                  borderRadius: 10,
                  padding: "7px 16px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: query.trim() && !loading ? "pointer" : "not-allowed",
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                  transition: "background 0.15s",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  minWidth: 60,
                  justifyContent: "center",
                }}
              >
                {loading ? (
                  <>
                    <span
                      style={{
                        width: 11,
                        height: 11,
                        borderRadius: "50%",
                        border: "2px solid rgba(255,255,255,0.35)",
                        borderTopColor: "#fff",
                        display: "inline-block",
                        animation: "spin 0.8s linear infinite",
                        flexShrink: 0,
                      }}
                    />
                    <span>Pitching</span>
                    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                  </>
                ) : (
                  "Pitch"
                )}
              </button>
            </div>
          </div>
          {/* Quick chips */}
          <QuickFilterChips
            activeChip={null}
            onChip={(chip) => {
              if (chip.mode === "amenity") onAmenity(chip.amenityType);
              else onSearch(chip.query("Sydney", 3));
            }}
            style={{ padding: "2px 0" }}
          />
        </div>

        {/* Recent */}
        {recentSearches.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 1.8,
                textTransform: "uppercase",
                color: C.textMuted,
                fontFamily: "'DM Sans', system-ui, sans-serif",
                marginBottom: 8,
              }}
            >
              Recent
            </div>
            {recentSearches.map((p, i) => (
              <div
                key={i}
                onClick={() => setQuery(p)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderRadius: 12,
                  padding: "11px 14px",
                  cursor: "pointer",
                  marginBottom: 6,
                  boxShadow: `0 1px 4px ${C.shadow}`,
                }}
              >
                <span style={{ fontSize: 13 }}>🕐</span>
                <span
                  style={{
                    fontSize: 12,
                    color: C.textMid,
                    fontFamily: "'DM Sans', system-ui, sans-serif",
                    lineHeight: 1.4,
                  }}
                >
                  {p}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Suggested */}
        <div style={{ marginBottom: 32 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1.8,
              textTransform: "uppercase",
              color: C.textMuted,
              fontFamily: "'DM Sans', system-ui, sans-serif",
              marginBottom: 8,
            }}
          >
            Suggested
          </div>
          {EXAMPLE_PROMPTS.map((p, i) => (
            <div
              key={i}
              onClick={() => setQuery(p)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                padding: "11px 14px",
                cursor: "pointer",
                marginBottom: 6,
                boxShadow: `0 1px 4px ${C.shadow}`,
              }}
            >
              <span style={{ fontSize: 13, color: C.sage }}>↗</span>
              <span
                style={{
                  fontSize: 12,
                  color: C.textMid,
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                  lineHeight: 1.4,
                }}
              >
                {p}
              </span>
            </div>
          ))}
        </div>

        {loading && (
          <div style={{ padding: "8px 0 32px" }}>
            <div
              style={{
                fontSize: 11,
                color: C.textMuted,
                fontFamily: "'DM Sans', system-ui, sans-serif",
                textAlign: "center",
                marginBottom: 10,
              }}
            >
              {loadingMsg}
            </div>
            <div
              style={{
                width: 48,
                height: 2,
                background: C.bgAlt,
                borderRadius: 1,
                margin: "0 auto",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  background: C.forest,
                  borderRadius: 1,
                  animation: "ldprogress 1.8s ease-in-out infinite",
                }}
              />
            </div>
            <style>{`@keyframes ldprogress{0%{width:0%;margin-left:0}50%{width:100%;margin-left:0}100%{width:0%;margin-left:100%}}`}</style>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Map screen ────────────────────────────────────────────────────────────────
function MapScreen({
  results,
  amenityResults,
  searchState,
  onSearch,
  onAmenity,
  onSearchAgain,
  loading,
  loadingMsg,
  onGoHome,
}) {
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [activeChip, setActiveChip] = useState(null);
  const initDrawer =
    new URLSearchParams(window.location.search).get("capture") === "drawer"
      ? "full"
      : "peek";
  const [drawer, setDrawer] = useState(initDrawer);
  const mapRef = useRef(null);
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  function handleTouchStart(e) {
    if (e.touches.length !== 1) return; // ignore pinch-to-zoom
    const x = e.touches[0].clientX;
    if (x < 40) {
      // only track left-edge swipes (like iOS back gesture)
      touchStartX.current = x;
      touchStartY.current = e.touches[0].clientY;
    }
  }
  function handleTouchEnd(e) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
    if (dx > 60 && dy < 60 && onGoHome) onGoHome();
    touchStartX.current = null;
    touchStartY.current = null;
  }
  const city = CITIES.find((c) => c.key === searchState.cityKey);

  const allLats = [city.lat, ...results.map((r) => r.lat)];
  const allLngs = [city.lng, ...results.map((r) => r.lng)];
  const minLat = Math.min(...allLats),
    maxLat = Math.max(...allLats);
  const minLng = Math.min(...allLngs),
    maxLng = Math.max(...allLngs);
  const pad = 0.15,
    latR = maxLat - minLat || 1,
    lngR = maxLng - minLng || 1;
  function toXY(lat, lng) {
    return {
      x: (((lng - minLng) / lngR) * (1 - pad * 2) + pad) * 100,
      y: (1 - (((lat - minLat) / latR) * (1 - pad * 2) + pad)) * 100,
    };
  }

  const drawerHeight =
    drawer === "full" ? "82vh" : drawer === "half" ? "52vh" : "116px";
  function cycleDrawer() {
    setDrawer((d) => (d === "peek" ? "half" : d === "half" ? "full" : "peek"));
  }
  function selectPin(i) {
    setSelectedIdx(i);
    setDrawer("peek");
  }

  const allItems = [...results, ...(amenityResults || [])];

  // Campsite card component
  function CampsiteCard({ r, compact = false }) {
    const sc = scoreRegion(r.days);
    const b = getBadge(sc);
    return (
      <div
        style={{
          background: C.surface,
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: `0 2px 12px ${C.shadow}`,
        }}
      >
        {!compact && <ScenicPhoto seed={results.indexOf(r)} height={120} />}
        <div style={{ padding: compact ? "10px 12px" : "12px 14px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 4,
            }}
          >
            <div style={{ flex: 1, marginRight: 8 }}>
              <div
                style={{
                  fontSize: compact ? 13 : 15,
                  fontWeight: 400,
                  color: C.forest,
                  fontFamily: "'DM Serif Display', Georgia, serif",
                  marginBottom: 2,
                  lineHeight: 1.2,
                }}
              >
                {r.name}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: C.textMuted,
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                }}
              >
                🚗 {driveLabel(r.driveHrs)} · {r.blurb}
              </div>
            </div>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: "3px 9px",
                borderRadius: 100,
                color: b.color,
                background: b.bg,
                flexShrink: 0,
                fontFamily: "'DM Sans', system-ui, sans-serif",
              }}
            >
              ● {b.label}
            </span>
          </div>
          <WeatherStrip days={r.days} />
          <div style={{ display: "flex", gap: 2 }}>
            {r.days?.map((d, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                <span
                  style={{
                    fontSize: 7,
                    color: C.textMuted,
                    textTransform: "uppercase",
                    fontWeight: 700,
                    fontFamily: "'DM Sans', system-ui, sans-serif",
                  }}
                >
                  {d.dayName}
                </span>
                <span style={{ fontSize: 13 }}>{getIcon(d.condition)}</span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: C.text,
                    fontFamily: "'DM Sans', system-ui, sans-serif",
                  }}
                >
                  {d.hi}°
                </span>
                <span
                  style={{
                    fontSize: 8,
                    color: C.textMuted,
                    fontFamily: "'DM Sans', system-ui, sans-serif",
                  }}
                >
                  {d.rainChance}%
                </span>
              </div>
            ))}
          </div>
          <ActivityTags tags={r.tags || []} />
          {!compact && r.summary && (
            <div
              style={{
                fontSize: 11,
                color: C.textMid,
                marginTop: 8,
                lineHeight: 1.55,
                fontFamily: "'DM Sans', system-ui, sans-serif",
                borderTop: `1px solid ${C.border}`,
                paddingTop: 8,
              }}
            >
              {r.summary}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Amenity card component
  function AmenityCard({ r, compact = false }) {
    const meta = AMENITY_META[r.amenityType] || {
      icon: "📍",
      color: "#888",
      label: "POI",
      typeLabel: "POI",
    };
    return (
      <div
        style={{
          background: C.surface,
          borderRadius: 16,
          padding: "12px 14px",
          boxShadow: `0 2px 12px ${C.shadow}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: meta.color + "18",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              flexShrink: 0,
            }}
          >
            {meta.icon}
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: C.forest,
                fontFamily: "'DM Serif Display', Georgia, serif",
                marginBottom: 2,
              }}
            >
              {r.name}
            </div>
            <div
              style={{
                fontSize: 10,
                color: C.textMuted,
                fontFamily: "'DM Sans', system-ui, sans-serif",
              }}
            >
              🚗 {driveLabel(r.driveHrs)}
            </div>
          </div>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: "3px 9px",
              borderRadius: 100,
              color: meta.color,
              background: meta.color + "15",
              fontFamily: "'DM Sans', system-ui, sans-serif",
            }}
          >
            {meta.typeLabel}
          </span>
        </div>
        {!compact && (
          <div
            style={{
              fontSize: 11,
              color: C.textMid,
              marginTop: 8,
              fontFamily: "'DM Sans', system-ui, sans-serif",
              lineHeight: 1.5,
            }}
          >
            {r.blurb}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        position: "fixed",
        inset: 0,
        background: C.bgAlt,
        fontFamily: "'DM Sans', system-ui, sans-serif",
        color: C.text,
        overflow: "hidden",
      }}
    >
      <style>{FONTS}</style>

      {/* ── MAP ── */}
      <div style={{ position: "absolute", inset: 0 }}>
        {allItems.length > 0 &&
          (() => {
            const bounds = allItems.map((r) => [r.lat, r.lng]);
            return (
              <MapContainer
                center={[city.lat, city.lng]}
                zoom={9}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                }}
                zoomControl={false}
                attributionControl={false}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <MapController
                  bounds={bounds}
                  cityKey={searchState.cityKey}
                  controlRef={mapRef}
                />

                {/* City marker */}
                <Marker
                  position={[city.lat, city.lng]}
                  icon={L.divIcon({
                    html: `<div style="width:11px;height:11px;border-radius:50%;background:${C.coral};border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>`,
                    className: "",
                    iconSize: [11, 11],
                    iconAnchor: [5.5, 5.5],
                  })}
                />

                {/* Campsite pins */}
                {results.map((r, i) => {
                  const sc = scoreRegion(r.days);
                  const b = getBadge(sc);
                  const isSel = selectedIdx === i;
                  const sz = isSel ? 38 : 28;
                  const shortN = r.name
                    .replace(" National Park", " NP")
                    .replace(" Conservation Park", " CP")
                    .split(" – ")[0];
                  const pinHtml = `<div style="display:flex;flex-direction:column;align-items:center;"><div style="width:${sz}px;height:${sz}px;border-radius:50%;background:${isSel ? b.dot : C.surface};border:2.5px solid ${b.dot};box-shadow:0 2px 8px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:${isSel ? 13 : 10}px;color:${isSel ? "#fff" : b.dot};font-family:DM Sans,sans-serif;">${i + 1}</div><div style="margin-top:3px;background:rgba(0,0,0,0.62);border-radius:8px;padding:2px 6px;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center;font-size:${isSel ? 9.5 : 8.5}px;font-weight:${isSel ? 700 : 600};color:#fff;font-family:DM Sans,sans-serif;">${shortN}</div></div>`;
                  return (
                    <Marker
                      key={`${r.name}-${isSel}`}
                      position={[r.lat, r.lng]}
                      icon={L.divIcon({
                        html: pinHtml,
                        className: "",
                        iconSize: [90, sz + 18],
                        iconAnchor: [45, sz],
                      })}
                      eventHandlers={{ click: () => selectPin(i) }}
                    />
                  );
                })}

                {/* Amenity pins */}
                {(amenityResults || []).map((r, i) => {
                  const meta = AMENITY_META[r.amenityType] || {
                    icon: "📍",
                    color: "#888",
                  };
                  const isSel = selectedIdx === results.length + i;
                  const sz = isSel ? 34 : 26;
                  return (
                    <Marker
                      key={`${r.name}-${isSel}`}
                      position={[r.lat, r.lng]}
                      icon={L.divIcon({
                        html: `<div style="width:${sz}px;height:${sz}px;border-radius:50%;background:${C.surface};border:2.5px solid ${meta.color};box-shadow:0 2px 8px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;font-size:${isSel ? 14 : 11}px;">${meta.icon}</div>`,
                        className: "",
                        iconSize: [sz, sz],
                        iconAnchor: [sz / 2, sz / 2],
                      })}
                      eventHandlers={{
                        click: () => selectPin(results.length + i),
                      }}
                    />
                  );
                })}
              </MapContainer>
            );
          })()}

        {/* Map controls */}
        <div
          style={{
            position: "absolute",
            right: 12,
            top: "42%",
            display: "flex",
            flexDirection: "column",
            gap: 4,
            zIndex: 1000,
          }}
        >
          <div
            onClick={() => {
              const m = mapRef.current;
              if (m)
                m.fitBounds(
                  allItems.map((r) => [r.lat, r.lng]),
                  { padding: [50, 50] },
                );
            }}
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: C.surface,
              border: `1px solid ${C.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              fontWeight: 700,
              color: C.forest,
              boxShadow: `0 2px 6px ${C.shadow}`,
              marginBottom: 4,
              cursor: "pointer",
            }}
          >
            N
          </div>
          <div
            onClick={() => mapRef.current?.zoomIn()}
            style={{
              width: 32,
              height: 32,
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              fontWeight: 300,
              color: C.text,
              cursor: "pointer",
              boxShadow: `0 2px 6px ${C.shadow}`,
            }}
          >
            +
          </div>
          <div
            onClick={() => mapRef.current?.zoomOut()}
            style={{
              width: 32,
              height: 32,
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              fontWeight: 300,
              color: C.text,
              cursor: "pointer",
              boxShadow: `0 2px 6px ${C.shadow}`,
            }}
          >
            −
          </div>
        </div>
      </div>

      {/* ── TOP BAR — always visible, floats above drawer ── */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          padding: "48px 12px 0",
          zIndex: 1200,
        }}
      >
        <SearchBar
          searchState={searchState}
          onSearch={onSearch}
          onEdit={onSearchAgain}
        />
        <QuickFilterChips
          activeChip={activeChip}
          onChip={(chip) => {
            setActiveChip(chip.key);
            if (chip.mode === "amenity") onAmenity(chip.amenityType);
            else
              onSearch(
                chip.query(city?.label || "Sydney", searchState.driveHrs || 3),
              );
          }}
        />
      </div>

      {/* Loading overlay */}
      {loading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1200,
            background: "rgba(247,245,240,0.82)",
            backdropFilter: "blur(4px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              border: `3px solid ${C.border}`,
              borderTopColor: C.coral,
              animation: "spin 0.9s linear infinite",
            }}
          />
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontFamily: "'DM Serif Display', Georgia, serif",
                fontSize: 16,
                color: C.forest,
                marginBottom: 4,
              }}
            >
              Finding the best spots…
            </div>
            <div
              style={{
                fontSize: 12,
                color: C.textMuted,
                maxWidth: 220,
                lineHeight: 1.5,
              }}
            >
              {loadingMsg}
            </div>
          </div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {/* ── BOTTOM DRAWER ── */}
      <div
        style={{
          position: drawer === "full" ? "fixed" : "absolute",
          top: drawer === "full" ? 0 : "auto",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          height: drawer === "full" ? "100dvh" : drawerHeight,
          display: "flex",
          flexDirection: "column",
          background: C.bg,
          borderRadius: drawer === "full" ? 0 : "22px 22px 0 0",
          boxShadow: `0 -4px 28px ${C.shadowLg}`,
          transition: "all 0.32s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        {/* Spacer when full — clears the floating top bar so content starts below it */}
        {drawer === "full" && <div style={{ height: 148, flexShrink: 0 }} />}

        {/* Handle + summary */}
        <div
          onClick={cycleDrawer}
          style={{
            padding: "10px 16px 0",
            cursor: "pointer",
            flexShrink: 0,
            borderTop: drawer === "full" ? `1px solid ${C.border}` : "none",
          }}
        >
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              background: C.border,
              margin: "0 auto 10px",
            }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              {amenityResults?.length > 0 ? (
                <>
                  <span
                    style={{ fontSize: 13, fontWeight: 700, color: C.forest }}
                  >
                    {amenityResults.length} locations found
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      color: C.textMuted,
                      marginLeft: 6,
                      fontFamily: "'DM Sans', system-ui, sans-serif",
                    }}
                  >
                    {AMENITY_META[amenityResults[0]?.amenityType]?.label} ·{" "}
                    {city.label}
                  </span>
                </>
              ) : (
                <>
                  <span
                    style={{ fontSize: 13, fontWeight: 700, color: C.forest }}
                  >
                    {results.length} areas found
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      color: C.textMuted,
                      marginLeft: 6,
                      fontFamily: "'DM Sans', system-ui, sans-serif",
                    }}
                  >
                    ranked by weather · {driveLabel(searchState.driveHrs)} of{" "}
                    {city.label}
                  </span>
                </>
              )}
            </div>
            <span style={{ fontSize: 10, color: C.coral, fontWeight: 700 }}>
              {drawer === "full" ? "▼ Less" : "▲ More"}
            </span>
          </div>
        </div>

        {/* Peek */}
        {drawer === "peek" && (
          <div style={{ padding: "10px 14px 24px", overflow: "hidden" }}>
            {(() => {
              const r = allItems[selectedIdx ?? 0];
              if (!r) return null;
              return r.amenityType ? (
                <AmenityCard r={r} />
              ) : (
                <CampsiteCard r={r} />
              );
            })()}
          </div>
        )}

        {/* Half / Full */}
        {(drawer === "half" || drawer === "full") && (
          <div
            style={{ flex: 1, overflowY: "auto", padding: "10px 14px 32px" }}
          >
            {allItems.map((r, i) => {
              const isSel = selectedIdx === i;
              return (
                <div
                  key={r.name + i}
                  onClick={() => selectPin(i)}
                  style={{
                    marginBottom: 12,
                    outline: isSel ? `2px solid ${C.coral}` : "none",
                    borderRadius: 16,
                    cursor: "pointer",
                  }}
                >
                  {r.amenityType ? (
                    <AmenityCard r={r} compact={drawer === "half"} />
                  ) : (
                    <CampsiteCard r={r} compact={drawer === "half"} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Filter panel ──────────────────────────────────────────────────────────────
function FilterPanel({ state, searchState, onNLSearch, onSearch, onClose }) {
  const [d0, setD0] = useState(state.d0);
  const [d1, setD1] = useState(state.d1);
  const [cityKey, setCityKey] = useState(state.cityKey || "sydney");
  const [driveHrs, setDriveHrs] = useState(state.driveHrs || 3);
  const [activities, setActivities] = useState(state.activityFilters || []);
  const [amenities, setAmenities] = useState(state.amenityFilters || []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });

  function pickDate(d) {
    if (!d0 || (d0 && d1)) {
      setD0(d);
      setD1(null);
    } else if (d.getTime() === d0.getTime()) setD0(null);
    else if (d < d0) {
      setD1(d0);
      setD0(d);
    } else setD1(d);
  }
  function rangeLabel() {
    if (!d0) return "Select start date";
    const s = `${DAYS[d0.getDay()]} ${d0.getDate()} ${MONTHS[d0.getMonth()]}`;
    if (!d1) return `${s} — select end date`;
    return `${s} → ${DAYS[d1.getDay()]} ${d1.getDate()} ${MONTHS[d1.getMonth()]} · ${Math.round((d1 - d0) / 86400000)} nights`;
  }
  function toggleActivity(key) {
    setActivities((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }
  function toggleAmenity(key) {
    setAmenities((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  const areaCount = (CAMPING_AREAS[cityKey] || []).filter(
    (a) => a.driveHrs <= driveHrs,
  ).length;
  const lbl = {
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: C.textMuted,
    fontWeight: 700,
    marginBottom: 10,
    display: "block",
    fontFamily: "'DM Sans', system-ui, sans-serif",
  };

  const ACTIVITY_OPTIONS = [
    { key: "weather", label: "Good weather", emoji: "☀️" },
    { key: "dog", label: "Dog friendly", emoji: "🐕" },
    { key: "fishing", label: "Fishing", emoji: "🎣" },
    { key: "hiking", label: "Hiking", emoji: "🥾" },
  ];
  const AMENITY_OPTIONS = [
    { key: "dump", label: "Dump points", emoji: "🚐" },
    { key: "water", label: "Water fill", emoji: "💧" },
  ];

  function ToggleChip({ item, active, onToggle }) {
    return (
      <div
        onClick={() => onToggle(item.key)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 14px",
          borderRadius: 100,
          border: `1.5px solid ${active ? C.coral : C.border}`,
          background: active ? C.coralLight : C.surface,
          cursor: "pointer",
          marginRight: 8,
          marginBottom: 8,
          boxShadow: active ? `0 0 0 1px ${C.coral}` : C.shadow,
          transition: "all 0.15s",
          userSelect: "none",
        }}
      >
        <span style={{ fontSize: 15 }}>{item.emoji}</span>
        <span
          style={{
            fontSize: 12,
            fontWeight: active ? 600 : 400,
            color: active ? C.coral : C.text,
            fontFamily: "'DM Sans', system-ui, sans-serif",
          }}
        >
          {item.label}
        </span>
        {active && (
          <span
            style={{
              fontSize: 10,
              color: C.coral,
              fontWeight: 700,
              marginLeft: 2,
            }}
          >
            ✓
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: C.bg,
        display: "flex",
        flexDirection: "column",
        fontFamily: "'DM Sans', system-ui, sans-serif",
        color: C.text,
      }}
    >
      <style>{FONTS}</style>
      <div
        style={{
          padding: "48px 12px 12px",
          borderBottom: `1px solid ${C.border}`,
          background: C.surface,
        }}
      >
        <SearchBar
          searchState={searchState}
          onSearch={(q) => {
            onClose();
            onNLSearch(q);
          }}
          onEdit={onClose}
        />
      </div>
      <div
        style={{
          padding: "12px 16px 8px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.8,
            textTransform: "uppercase",
            color: C.textMuted,
          }}
        >
          Filters
        </span>
        <button
          onClick={onClose}
          style={{
            background: "transparent",
            border: "none",
            padding: "4px 8px",
            color: C.textMuted,
            fontSize: 20,
            cursor: "pointer",
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 16px 32px" }}>
        {/* Activities */}
        <div style={{ marginBottom: 20 }}>
          <span style={lbl}>Activities</span>
          <div style={{ display: "flex", flexWrap: "wrap" }}>
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

        {/* Amenities */}
        <div style={{ marginBottom: 20 }}>
          <span style={lbl}>Amenities</span>
          <div style={{ display: "flex", flexWrap: "wrap" }}>
            {AMENITY_OPTIONS.map((item) => (
              <ToggleChip
                key={item.key}
                item={item}
                active={amenities.includes(item.key)}
                onToggle={toggleAmenity}
              />
            ))}
          </div>
          {amenities.length > 0 && (
            <div
              style={{
                fontSize: 11,
                color: C.textMuted,
                marginTop: 2,
                fontStyle: "italic",
              }}
            >
              These will appear as pins alongside campsites on the map.
            </div>
          )}
        </div>

        {/* Dates */}
        <div style={{ marginBottom: 20 }}>
          <span style={lbl}>Dates</span>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7,1fr)",
              gap: 5,
              marginBottom: 8,
            }}
          >
            {dates.map((d) => {
              const sel =
                (d0 && d.getTime() === d0.getTime()) ||
                (d1 && d.getTime() === d1.getTime());
              const inR = d0 && d1 && d > d0 && d < d1;
              return (
                <div
                  key={d.getTime()}
                  onClick={() => pickDate(d)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    padding: "8px 2px",
                    borderRadius: 10,
                    border: `1.5px solid ${sel ? C.coral : inR ? "rgba(232,103,74,0.3)" : C.border}`,
                    background: sel ? C.coral : inR ? C.coralLight : C.surface,
                    cursor: "pointer",
                    boxShadow: sel
                      ? `0 2px 8px ${C.shadowMd}`
                      : `0 1px 3px ${C.shadow}`,
                    transition: "all 0.15s",
                  }}
                >
                  <span
                    style={{
                      fontSize: 8,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      color: sel
                        ? "rgba(255,255,255,0.8)"
                        : inR
                          ? C.coral
                          : C.textMuted,
                      letterSpacing: 0.3,
                    }}
                  >
                    {DAYS[d.getDay()].slice(0, 1)}
                  </span>
                  <span
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: sel ? "#fff" : C.text,
                      marginTop: 2,
                    }}
                  >
                    {d.getDate()}
                  </span>
                </div>
              );
            })}
          </div>
          <div
            style={{ fontSize: 11, color: d0 && d1 ? C.coral : C.textMuted }}
          >
            {rangeLabel()}
          </div>
        </div>

        {/* City */}
        <div style={{ marginBottom: 20 }}>
          <span style={lbl}>Nearest city</span>
          <div style={{ position: "relative" }}>
            <select
              value={cityKey}
              onChange={(e) => setCityKey(e.target.value)}
              style={{
                width: "100%",
                appearance: "none",
                WebkitAppearance: "none",
                background: C.surface,
                border: `1.5px solid ${C.border}`,
                borderRadius: 12,
                padding: "13px 40px 13px 14px",
                fontSize: 14,
                fontWeight: 600,
                color: C.text,
                fontFamily: "'DM Sans', system-ui, sans-serif",
                outline: "none",
                cursor: "pointer",
                boxShadow: `0 1px 4px ${C.shadow}`,
              }}
            >
              {CITIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
            <span
              style={{
                position: "absolute",
                right: 14,
                top: "50%",
                transform: "translateY(-50%)",
                pointerEvents: "none",
                color: C.coral,
                fontSize: 12,
              }}
            >
              ▾
            </span>
          </div>
        </div>

        {/* Drive time */}
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 10,
            }}
          >
            <span style={lbl}>Max drive time</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: C.coral }}>
              {driveHrs}hr{" "}
              <span
                style={{ fontSize: 11, color: C.textMuted, fontWeight: 400 }}
              >
                · {areaCount} areas
              </span>
            </span>
          </div>
          <div
            style={{
              position: "relative",
              height: 36,
              display: "flex",
              alignItems: "center",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                height: 4,
                borderRadius: 2,
                background: C.bgAlt,
                border: `1px solid ${C.border}`,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 0,
                width: `${((driveHrs - 0.5) / 2.5) * 100}%`,
                height: 4,
                borderRadius: 2,
                background: C.coral,
              }}
            />
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.5"
              value={driveHrs}
              onChange={(e) => setDriveHrs(parseFloat(e.target.value))}
              style={{
                position: "relative",
                width: "100%",
                appearance: "none",
                WebkitAppearance: "none",
                background: "transparent",
                outline: "none",
                margin: 0,
                cursor: "pointer",
                height: 36,
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 4,
            }}
          >
            {["30min", "1hr", "1.5hr", "2hr", "2.5hr", "3hr"].map((l, i) => (
              <span key={i} style={{ fontSize: 9, color: C.textMuted }}>
                {l}
              </span>
            ))}
          </div>
          <style>{`input[type=range]::-webkit-slider-thumb{appearance:none;width:22px;height:22px;border-radius:50%;background:${C.coral};border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.2);cursor:pointer;} input[type=range]::-moz-range-thumb{width:22px;height:22px;border-radius:50%;background:${C.coral};border:2px solid #fff;cursor:pointer;}`}</style>
        </div>

        <button
          onClick={() => {
            if (d0 && d1)
              onSearch({
                d0,
                d1,
                cityKey,
                driveHrs,
                activityFilters: activities,
                amenityFilters: amenities,
              });
          }}
          disabled={!d0 || !d1}
          style={{
            width: "100%",
            padding: 15,
            background: d0 && d1 ? C.coral : "#e8ddd4",
            color: d0 && d1 ? "#fff" : C.textMuted,
            border: "none",
            borderRadius: 14,
            fontSize: 15,
            fontWeight: 700,
            cursor: d0 && d1 ? "pointer" : "not-allowed",
            fontFamily: "'DM Sans', system-ui, sans-serif",
            boxShadow: d0 && d1 ? `0 4px 16px ${C.coral}44` : "none",
            transition: "all 0.15s",
          }}
        >
          {d0 && d1 ? "Search with these filters" : "Select dates to search"}
        </button>
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function PitchdLight() {
  const [screen, setScreen] = useState("home");
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [results, setResults] = useState([]);
  const [amenityResults, setAmenityResults] = useState([]);
  const [searchState, setSearchState] = useState({
    d0: null,
    d1: null,
    cityKey: "sydney",
    driveHrs: 3,
    activityFilters: [],
    amenityFilters: [],
  });
  const [errMsg, setErrMsg] = useState("");
  const [recentSearches, setRecentSearches] = useState([]);

  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("capture");
    if (s === "loading") {
      setLoading(true);
      setLoadingMsg("Finding the best spots for your trip…");
    } else if (s === "map-loading") {
      setScreen("results");
      setLoading(true);
      setLoadingMsg("Checking weather across the region…");
    } else if (s === "results" || s === "filters" || s === "drawer") {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const dow = now.getDay(),
        daysToSat = dow === 6 ? 7 : 6 - dow;
      const d0 = new Date(now.getTime() + daysToSat * 86400000);
      const d1 = new Date(d0.getTime() + 86400000);
      runSearch({ d0, d1, cityKey: "sydney", driveHrs: 3 }).then(() => {
        if (s === "filters") setShowFilters(true);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function searchFromNL(query) {
    setLoading(true);
    setErrMsg("");
    setLoadingMsg("Understanding your search…");
    setRecentSearches((prev) =>
      [query, ...prev.filter((q) => q !== query)].slice(0, 3),
    );
    try {
      const parsed = await parseNL(query);
      const cityKey = parsed.city || "sydney",
        driveHrs = parsed.driveHrs || 3;
      let d0 = null,
        d1 = null;
      if (parsed.dateFrom) {
        d0 = new Date(parsed.dateFrom + "T00:00:00");
        d1 = parsed.dateTo
          ? new Date(parsed.dateTo + "T00:00:00")
          : new Date(d0.getTime() + 86400000 * 2);
      } else {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const dow = now.getDay(),
          daysToSat = dow === 6 ? 7 : 6 - dow;
        d0 = new Date(now.getTime() + daysToSat * 86400000);
        d1 = new Date(d0.getTime() + 86400000);
      }
      await runSearch({ d0, d1, cityKey, driveHrs });
    } catch (e) {
      // API unavailable — fall back to default params (Sydney, 3hr, this weekend)
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const dow = now.getDay(),
        daysToSat = dow === 6 ? 7 : 6 - dow;
      const d0 = new Date(now.getTime() + daysToSat * 86400000);
      const d1 = new Date(d0.getTime() + 86400000);
      await runSearch({ d0, d1, cityKey: "sydney", driveHrs: 3 });
    }
  }

  function showAmenity(amenityType) {
    const cityKey = searchState.cityKey || "sydney";
    const city = CITIES.find((c) => c.key === cityKey);
    const pois = (AMENITY_POIS[amenityType] || {})[cityKey] || [];
    const driveHrs = searchState.driveHrs || 3;
    const filtered = pois
      .filter((p) => p.driveHrs <= driveHrs)
      .map((p) => ({
        ...p,
        amenityType,
        lat: city.lat + p.dLat,
        lng: city.lng + p.dLng,
      }));
    setAmenityResults(filtered);
    setResults([]);
    setScreen("results");
  }

  async function runSearch(state) {
    setLoading(true);
    setErrMsg("");
    setSearchState(state);
    const {
      d0,
      d1,
      cityKey,
      driveHrs,
      activityFilters = [],
      amenityFilters = [],
    } = state;
    const city = CITIES.find((c) => c.key === cityKey);
    const allAreas = CAMPING_AREAS[cityKey] || CAMPING_AREAS.sydney;
    // Filter by drive time, then optionally by activity tags
    const byDrive = allAreas.filter((a) => a.driveHrs <= driveHrs);
    const tagFilters = activityFilters.filter((f) => f !== "weather");
    const weatherOnly =
      activityFilters.includes("weather") && tagFilters.length === 0;
    const byActivity =
      tagFilters.length > 0
        ? byDrive.filter((a) =>
            tagFilters.every((f) => (a.tags || []).includes(f)),
          )
        : byDrive;
    const pool = byActivity.length >= 3 ? byActivity : byDrive; // fallback if filters too narrow
    const step = pool.length > 8 ? Math.floor(pool.length / 8) : 1;
    const sampled = pool.filter((_, i) => i % step === 0).slice(0, 8);
    try {
      setLoadingMsg(
        `Checking weather across ${sampled.length} areas within ${driveHrs}hr of ${city.label}…`,
      );
      const weatherData = await fetchWeather(
        sampled,
        isoDate(d0),
        isoDate(d1),
        city.label,
      );
      const scored = sampled
        .map((area) => {
          const wd = weatherData.find((w) => w.name === area.name) || {};
          const days = (wd.days || []).map((d) => ({
            ...d,
            dayName: DAYS[new Date(d.date + "T00:00:00").getDay()],
          }));
          return {
            area,
            days,
            summary: wd.summary || "",
            score: scoreRegion(days),
          };
        })
        .sort((a, b) => b.score - a.score);
      const goodWeatherOnly = activityFilters.includes("weather");
      const finalScored = goodWeatherOnly
        ? (scored.filter((r) => r.score >= 60).length >= 2
            ? scored.filter((r) => r.score >= 60)
            : scored
          ).slice(0, 5)
        : scored.slice(0, 5);
      // Load any selected amenity types alongside campsite results
      const combinedAmenities = amenityFilters.flatMap((type) => {
        const pois = (AMENITY_POIS[type] || {})[cityKey] || [];
        return pois
          .filter((p) => p.driveHrs <= driveHrs)
          .map((p) => ({
            ...p,
            amenityType: type,
            lat: city.lat + p.dLat,
            lng: city.lng + p.dLng,
          }));
      });
      setAmenityResults(combinedAmenities);
      setResults(
        finalScored.map((r) => ({
          ...r.area,
          days: r.days,
          summary: r.summary,
        })),
      );
      setShowFilters(false);
      setScreen("results");
    } catch (e) {
      setErrMsg(e.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {screen === "home" && (
        <HomeScreen
          onSearch={searchFromNL}
          onAmenity={showAmenity}
          loading={loading}
          loadingMsg={loadingMsg}
          recentSearches={recentSearches}
          onGoToMap={() => setScreen("results")}
          hasResults={results.length > 0 || amenityResults.length > 0}
        />
      )}
      {screen === "results" && (
        <MapScreen
          results={results}
          amenityResults={amenityResults}
          searchState={searchState}
          onSearch={searchFromNL}
          onAmenity={showAmenity}
          onSearchAgain={() => setShowFilters(true)}
          loading={loading}
          loadingMsg={loadingMsg}
          onGoHome={() => setScreen("home")}
        />
      )}
      {showFilters && (
        <FilterPanel
          state={searchState}
          searchState={searchState}
          onNLSearch={(q) => {
            setShowFilters(false);
            searchFromNL(q);
          }}
          onSearch={(state) => {
            setShowFilters(false);
            runSearch(state);
          }}
          onClose={() => setShowFilters(false)}
        />
      )}
      {errMsg && (
        <div
          style={{
            position: "fixed",
            bottom: 32,
            left: 16,
            right: 16,
            background: C.coralLight,
            border: `1px solid ${C.coral}`,
            borderRadius: 12,
            padding: "12px 16px",
            fontSize: 13,
            color: C.coral,
            textAlign: "center",
            zIndex: 300,
            fontFamily: "'DM Sans', system-ui, sans-serif",
          }}
        >
          ⚠️ {errMsg}
        </div>
      )}
    </>
  );
}
