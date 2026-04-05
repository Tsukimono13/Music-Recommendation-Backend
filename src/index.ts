import "dotenv/config";
import { createApp } from "./http/app";
import { startKeepAlive, stopKeepAlive } from "./core/utils/keep-alive";

const app = createApp();
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
  startKeepAlive();
});

function shutdown(signal: string) {
  console.log(`\n${signal} received — shutting down gracefully...`);
  stopKeepAlive();
  server.close(() => {
    console.log("Server closed.");
    process.exit(0);
  });
  setTimeout(() => {
    console.warn("Forceful shutdown — timeout exceeded.");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
