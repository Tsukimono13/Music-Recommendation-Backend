export class TimedCache<V> {
  private cache = new Map<string, { data: V; cachedAt: number }>();
  private readonly ttlMs: number;
  private readonly maxSize: number;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(ttlMs: number, maxSize = 5000) {
    this.ttlMs = ttlMs;
    this.maxSize = maxSize;
    this.cleanupTimer = setInterval(() => this.evict(), ttlMs);
    this.cleanupTimer.unref();
  }

  get(key: string): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.cachedAt >= this.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.data;
  }

  set(key: string, data: V): void {
    if (this.cache.size >= this.maxSize) {
      this.evict();
      if (this.cache.size >= this.maxSize) {
        const firstKey = this.cache.keys().next().value;
        if (firstKey !== undefined) this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, { data, cachedAt: Date.now() });
  }

  private evict(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now - entry.cachedAt >= this.ttlMs) {
        this.cache.delete(key);
      }
    }
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.cache.clear();
  }
}
