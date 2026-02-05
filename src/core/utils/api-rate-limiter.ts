class ApiRateLimiter {
  private lastRequestTime: number = 0;
  private minDelay: number;

  constructor(minDelayMs: number) {
    this.minDelay = minDelayMs;
  }

  async wait(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minDelay) {
      const waitTime = this.minDelay - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }
}

export const musicBrainzRateLimiter = new ApiRateLimiter(
  Number(process.env.MUSICBRAINZ_RATE_LIMIT_MS) || 1000,
);
