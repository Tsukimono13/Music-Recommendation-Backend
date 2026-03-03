/**
 * Парсинг свободного текста пользователя в структуру для рекомендаций:
 * { artists?: string[], tags?: string[] }.
 * Использует Gemini/Gemma: извлечение жанров и артистов, при необходимости перевод с русского.
 */

export interface ParsedRecommendationInput {
  artists?: string[];
  tags?: string[];
}

/** По умолчанию gemini-2.0-flash. Для Gemma 3 4B задайте GEMINI_MODEL=gemma-3-4b-it (если доступен в вашем API). */
const DEFAULT_MODEL = "gemini-2.0-flash";
const MODEL_ENV = process.env.GEMINI_MODEL || process.env.GEMMA_MODEL;

const INSTRUCTION = `Ты — парсер запросов к музыкальному рекомендательному сервису.
Из сообщения пользователя извлеки названия артистов/групп и жанры (теги).
Правила: артистов в виде для каталогов (Bon Jovi, Земфира). Жанры — на английском, lowercase (thrash metal, power metal, 80s, 90s). Русские названия артистов можно оставить как есть или дать латиницу, если так чаще ищут.
Ответь только одним JSON-объектом без markdown: {"artists": ["..."], "tags": ["..."]}. Поля artists и tags опциональны.`;

export async function parseRecommendationQuery(
  userMessage: string,
  apiKey: string,
): Promise<ParsedRecommendationInput> {
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
    const parsed = JSON.parse(raw) as ParsedRecommendationInput;
    if (!parsed.artists && !parsed.tags) {
      return {};
    }
    return {
      artists: Array.isArray(parsed.artists)
        ? parsed.artists.filter((a) => typeof a === "string" && (a as string).trim()).map((a) => (a as string).trim())
        : undefined,
      tags: Array.isArray(parsed.tags)
        ? parsed.tags.filter((t) => typeof t === "string" && (t as string).trim()).map((t) => (t as string).trim().toLowerCase())
        : undefined,
    };
  } catch {
    return {};
  }
}
