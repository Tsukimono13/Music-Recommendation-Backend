const KEEP_ALIVE_URL = process.env.KEEP_ALIVE_URL;
const INTERVAL_MS = Number(process.env.KEEP_ALIVE_INTERVAL_MS) || 10 * 60 * 1000; // 10 мин

let timer: ReturnType<typeof setInterval> | null = null;

export function startKeepAlive(): void {
  if (!KEEP_ALIVE_URL) return;

  console.log(`[KeepAlive] Pinging ${KEEP_ALIVE_URL} every ${INTERVAL_MS / 1000}s`);

  timer = setInterval(async () => {
    try {
      const res = await fetch(KEEP_ALIVE_URL, { method: "GET" });
      console.log(`[KeepAlive] Ping -> ${res.status}`);
    } catch (err) {
      console.warn(`[KeepAlive] Ping failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, INTERVAL_MS);

  timer.unref();
}

export function stopKeepAlive(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
