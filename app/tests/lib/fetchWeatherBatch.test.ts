import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchWeatherBatch } from "@/lib/fetchWeatherBatch";
import type { Campsite } from "@/types/map";

const MOCK_FORECAST = {
  daily: {
    time: ["2026-03-23", "2026-03-24"],
    temperature_2m_max: [22.5, 24.0],
    temperature_2m_min: [15.1, 16.0],
    precipitation_sum: [0.0, 1.2],
    precipitation_probability_max: [10, 40],
    weathercode: [1, 61],
  },
};

function makeCampsites(count: number): Campsite[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `c${i}`,
    name: `Camp ${i}`,
    lat: -30 + i * 0.001,
    lng: 150,
    region: "NSW",
    blurb: null,
    amenities: [],
  }));
}

function makeResultsMap(campsites: Campsite[]): Record<string, unknown> {
  return Object.fromEntries(campsites.map((c) => [c.id, MOCK_FORECAST]));
}

describe("fetchWeatherBatch", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        const body = JSON.parse(init?.body as string) as { locations: { id: string }[] };
        const results = makeResultsMap(body.locations.map((l) => ({ id: l.id }) as Campsite));
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ results }),
        } as Response);
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("returns an empty array when given no campsites", async () => {
    const result = await fetchWeatherBatch([]);
    expect(result).toEqual([]);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("makes a single request when locations are 100 or fewer", async () => {
    const campsites = makeCampsites(100);
    await fetchWeatherBatch(campsites);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
    expect(body.locations).toHaveLength(100);
  });

  it("splits into 2 requests when 150 locations are provided", async () => {
    const campsites = makeCampsites(150);
    await fetchWeatherBatch(campsites);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
    const secondBody = JSON.parse(vi.mocked(fetch).mock.calls[1][1]?.body as string);
    expect(firstBody.locations).toHaveLength(100);
    expect(secondBody.locations).toHaveLength(50);
  });

  it("merges weather results from all chunks into the original campsite array order", async () => {
    const campsites = makeCampsites(150);
    const result = await fetchWeatherBatch(campsites);
    expect(result).toHaveLength(150);
    expect(result[0].id).toBe("c0");
    expect(result[149].id).toBe("c149");
    // All should have weather attached from MOCK_FORECAST
    for (const c of result) {
      expect(c.weather).not.toBeNull();
      expect(c.weather!.length).toBeGreaterThan(0);
    }
  });

  it("splits into 3 requests for 250 locations", async () => {
    const campsites = makeCampsites(250);
    await fetchWeatherBatch(campsites);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3);
  });

  it("returns weather: null for all campsites in a chunk when the request fails", async () => {
    const campsites = makeCampsites(10);
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    } as Response);

    const result = await fetchWeatherBatch(campsites);
    expect(result).toHaveLength(10);
    for (const c of result) {
      expect(c.weather).toBeNull();
    }
  });
});
