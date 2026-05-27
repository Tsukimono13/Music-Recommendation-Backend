import type { QueryInput } from "../models/query-input.model";
/** По умолчанию gemma-4-26b-a4b-it (щедрый free tier, MoE — быстрая). Переопределить можно через GEMINI_MODEL. */
const DEFAULT_MODEL = "gemma-4-26b-a4b-it";
const MODEL_ENV = process.env.GEMINI_MODEL || process.env.GEMMA_MODEL;

const INSTRUCTION = `Ты — парсер запросов к музыкальному рекомендательному сервису.
Извлеки из сообщения пользователя артистов и теги (жанры/эпохи/сцены).

Правила:

Артисты (artists):
- Извлекай при упоминании: "как X", "похоже на A, B", "в духе Y", "что-то между X и Y", "микс из X и Y". Всё это — запрос похожих артистов: верни упомянутых в artists.
- Если сообщение состоит только из имени артиста (или нескольких имён без явной фразы) — это тоже запрос похожих: верни их в artists. Примеры: "Louna" → {"artists": ["Louna"]}, "Metallica, Slayer" → {"artists": ["Metallica", "Slayer"]}.
- Один артист — один элемент массива (["Metallica", "Slayer"], НЕ "Metallica и Slayer").
- Если пользователь упоминает песню или альбом — извлекай артиста, а не название трека/альбома.
- Имена возвращай в латинице если это латинский артист: "Металика" → "Metallica", "Нирвана" → "Nirvana", "Слипкнот" → "Slipknot" (это транслитерация, не опечатка). Кириллических артистов оставляй на кириллице: "Земфира", "Сплин", "Ария".
- ВАЖНО: НЕ заменяй имя на похожее по написанию, даже если оно популярнее. Если пользователь написал "Louna" — верни "Louna", не "Loona". Если "Aria" — верни "Aria", не "Ария". Каталог сам найдёт нужного артиста или предложит исправление.
- Очевидные опечатки в латинице исправляй только если уверен (двойные/пропущенные буквы): "Metalica" → "Metallica", "Slpknot" → "Slipknot". Сомневаешься — оставляй как написал пользователь.
- Артистов в tags не дублируй.

Теги (tags):
- Только положительные пожелания. Фразы "не хочу X", "без Y" — игнорируй.
- Жанры, эпохи и географию переводи на английский, lowercase.
- Составные теги НЕ разделяй: страна + жанр → один тег (norwegian black metal, finnish metal). Жанр + эпоха → один тег (80s synthpop, 70s disco). Причина: по отдельным тегам каталог отдаёт нерелевантные результаты.
- Диапазоны эпох ("конец 80-х — начало 90-х", "late 80s early 90s") → два тега: 80s, 90s.
- Не добавляй настроение и расплывчатые эпитеты ("мрачный", "кайфовый", "aggressive") — только жанры, эпохи, географию.
- Не выдумывай теги и артистов, которых пользователь не упоминал.

Язык пользователя может быть любым — всегда отвечай JSON, теги всегда на английском.

Примеры:

Ввод: "хочу что-то похожее на Металику и Слэйер, трэш метал 80х"
Ответ: {"artists": ["Metallica", "Slayer"], "tags": ["80s thrash metal"]}

Ввод: "норвежский блэк метал, как Даркстроун"
Ответ: {"artists": ["Darkthrone"], "tags": ["norwegian black metal"]}

Ввод: "something like Radiohead but more electronic"
Ответ: {"artists": ["Radiohead"], "tags": ["electronic"]}

Ввод: "финский метал"
Ответ: {"tags": ["finnish metal"]}

Ввод: "90s, progressive metal"
Ответ: {"tags": ["90s progressive metal"]}

Ввод: "progressive metal 90х"
Ответ: {"tags": ["90s progressive metal"]}

Ввод: "что-то между Green Day и Blink-182"
Ответ: {"artists": ["Green Day", "Blink-182"]}

Ввод: "Louna"
Ответ: {"artists": ["Louna"]}

Ввод: "Slipknot"
Ответ: {"artists": ["Slipknot"]}

Ввод: "мне нравится песня Master of Puppets"
Ответ: {"artists": ["Metallica"]}

Ввод: "привет, как дела?"
Ответ: {}`;

export async function parseRecommendationQuery(
  userMessage: string,
  apiKey: string,
): Promise<QueryInput> {
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey });

  const model = MODEL_ENV || DEFAULT_MODEL;
  const supportsJsonMode = !model.toLowerCase().includes("gemma");
  const contents = `${INSTRUCTION}\n\nСообщение пользователя: ${userMessage.trim()}`;

  const response = await ai.models.generateContent({
    model,
    contents,
    ...(supportsJsonMode && {
      config: {
        responseMimeType: "application/json",
      },
    }),
  });

  const text = (response as { text?: string }).text?.trim();
  if (!text) {
    return {};
  }

  const jsonMatch = supportsJsonMode ? null : text.match(/\{[\s\S]*\}/);
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
  } catch (err) {
    console.warn(`[Gemini] Failed to parse response as JSON. Raw text: ${raw.slice(0, 500)}`, err);
    return {};
  }
}
