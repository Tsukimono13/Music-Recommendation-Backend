import type { QueryInput } from "../models/query-input.model";

/**
 * Парсинг свободного текста пользователя в структуру для рекомендаций (QueryInput).
 * Использует Gemini/Gemma: извлечение жанров и артистов, при необходимости перевод с русского.
 */

/** По умолчанию gemini-2.0-flash. Для Gemma 3 4B задайте GEMINI_MODEL=gemma-3-4b-it (если доступен в вашем API). */
const DEFAULT_MODEL = "gemini-2.0-flash";
const MODEL_ENV = process.env.GEMINI_MODEL || process.env.GEMMA_MODEL;

const INSTRUCTION = `Ты — парсер запросов к музыкальному рекомендательному сервису.
Из сообщения пользователя извлеки названия артистов/групп и жанры (теги).

Правила:
- Если пользователь называет артистов ("как X и Y", "похоже на A, B" и т.д.) — обязательно верни их в artists. Не добавляй этих артистов в tags. Артистов в виде для каталогов: Bon Jovi, Земфира, Metallica.
- Теги — только жанры и эпохи на английском, lowercase: thrash metal, power metal, 80s, 90s, classic rock. Не дублируй имена артистов в тегах.
- Ответ — строго один JSON без markdown: {"artists": ["..."], "tags": ["..."]}. Поля опциональны; если только жанр — только tags; если только артисты — только artists.`;

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
