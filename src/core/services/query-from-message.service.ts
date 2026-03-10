import type { QueryInput } from "../models/query-input.model";
/** По умолчанию gemini-2.0-flash. Для Gemma 3 4B задайте GEMINI_MODEL=gemma-3-4b-it (если доступен в вашем API). */
const DEFAULT_MODEL = "gemini-2.0-flash";
const MODEL_ENV = process.env.GEMINI_MODEL || process.env.GEMMA_MODEL;

const INSTRUCTION = `Ты — парсер запросов к музыкальному рекомендательному сервису.
Извлеки из сообщения пользователя артистов и теги (жанры/эпохи/сцены). Ответ — только один JSON, без markdown и без текста до или после.

Правила:

Артисты (artists):
- Извлекай при упоминании: "как X", "похоже на A, B", "в духе Y". Фразы "хочу что-то похожее на X", "что-нибудь как X" — это запрос похожих артистов: обязательно верни X в artists (по нему получим рекомендации similar artists). Один артист — один элемент массива (например ["Metallica", "Slayer"], не "Metallica и Slayer" в одной строке).
- Имена в каноническом виде для каталогов: Bon Jovi, Земфира, Metallica. Очевидные опечатки исправляй ("Металика" → "Metallica").
- Артистов в tags не дублируй.

Теги (tags):
- Только то, что пользователь хочет (положительные пожелания). Фразы "не хочу X", "без Y" игнорируй — в теги не включай.
- Жанры, эпохи и географию переводи на английский, lowercase. Короткие устоявшиеся формулировки: thrash metal, power metal, 80s, 90s, 2000s, classic rock, finnish metal, german metal.
- Важно: если пользователь называет страну/сцену вместе с жанром ("норвежский black metal", "финский метал") — давай один составной тег: norwegian black metal, finnish metal. Не разделяй на отдельные теги ("norwegian" + "black metal"): по отдельности каталог отдаёт не тех артистов.
- То же для жанр + эпоха: "synthpop 80s", "disco 70s" — один тег: 80s synthpop, 70s disco. Не разделяй на "synthpop" и "80s": по "synthpop" приходят и современные артисты, по "80s" — кто угодно из 80-х, в ответе получается смесь.
- Не добавляй настроение и расплывчатые эпитеты ("мрачный", "кайфовый") — только жанры, эпохи, географию. Не выдумывай теги и артистов.

Формат ответа:
- Строго один JSON: {"artists": ["..."], "tags": ["..."]}. Поля опциональны: только жанр — только tags; только артисты — только artists. Если ничего извлечь нельзя — верни {}.`;

export async function parseRecommendationQuery(
  userMessage: string,
  apiKey: string,
): Promise<QueryInput> {
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey });

  const model = MODEL_ENV || DEFAULT_MODEL;
  const contents = `${INSTRUCTION}\n\nСообщение пользователя: ${userMessage.trim()}`;

  const response = await ai.models.generateContent({
    model,
    contents,
  });

  const text = (response as { text?: string }).text?.trim();
  if (!text) {
    return {};
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const raw = jsonMatch ? jsonMatch[0] : text;

  try {
    const parsed = JSON.parse(raw) as QueryInput;
    if (!parsed.artists && !parsed.tags) {
      return {};
    }
    return {
      artists: Array.isArray(parsed.artists)
        ? parsed.artists
            .filter((a) => typeof a === "string" && (a as string).trim())
            .map((a) => (a as string).trim())
        : undefined,
      tags: Array.isArray(parsed.tags)
        ? parsed.tags
            .filter((t) => typeof t === "string" && (t as string).trim())
            .map((t) => (t as string).trim().toLowerCase())
        : undefined,
    };
  } catch {
    return {};
  }
}
