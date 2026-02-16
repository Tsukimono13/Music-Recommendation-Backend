export class ApiRateLimiter {
  private lastRequestTime: number = 0;
  private minDelay: number;

  private queue: Promise<void> = Promise.resolve();

  constructor(minDelayMs: number) {
    this.minDelay = minDelayMs;
  }

  async wait(): Promise<void> {
    const prev = this.queue;
    this.queue = prev.then(() => this.waitOne());
    return this.queue;
  }

  private async waitOne(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minDelay) {
      await new Promise((r) => setTimeout(r, this.minDelay - elapsed));
    }
    this.lastRequestTime = Date.now();
  }
}

export const musicBrainzRateLimiter = new ApiRateLimiter(
  Number(process.env.MUSICBRAINZ_RATE_LIMIT_MS) || 1000,
);
