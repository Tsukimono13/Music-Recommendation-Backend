import { describe, it, expect, vi, afterEach } from "vitest";
import { TimedCache } from "./timed-cache";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("TimedCache", () => {
  it("stores and retrieves values", () => {
    const cache = new TimedCache<string>(60_000);
    cache.set("key", "value");
    expect(cache.get("key")).toBe("value");
    cache.destroy();
  });

  it("returns undefined for expired entries", () => {
    vi.useFakeTimers();
    const cache = new TimedCache<string>(1000);
    cache.set("key", "value");
    vi.advanceTimersByTime(1001);
    expect(cache.get("key")).toBeUndefined();
    cache.destroy();
    vi.useRealTimers();
  });

  it("evicts oldest entry when max size reached", () => {
    const cache = new TimedCache<string>(60_000, 2);
    cache.set("a", "1");
    cache.set("b", "2");
    cache.set("c", "3");
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("c")).toBe("3");
    cache.destroy();
  });
});
