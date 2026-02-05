import "dotenv/config";
import { createApp } from "./http/app";

const app = createApp();
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
