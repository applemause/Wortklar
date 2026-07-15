type PagesContext = {
  request: Request;
  env: {
    apikey?: string;
    APIKEY?: string;
    GROQ_API_KEY?: string;
  };
};

const systemPrompt = `Ты — точный русско-немецкий учебный переводчик для русскоязычного ученика.
Верни только JSON без markdown в формате:
{
  "kind": "term|sentence",
  "correctedInput": "исправленный исходный текст или null",
  "translation": "основной естественный перевод",
  "explanation": "",
  "entries": [
    {
      "type": "noun|verb|adjective|phrase|other",
      "word": "слово или выражение на немецком",
      "translation": "перевод на русский",
      "article": "der|die|das|null",
      "plural": "форма множественного числа или null",
      "gender": "maskulin|feminin|neutral|null",
      "infinitive": "инфинитив или null",
      "preterite": "Präteritum или null",
      "participle": "Partizip II без вспомогательного глагола или null",
      "auxiliary": "haben|sein|null",
      "comparative": "Komparativ или null",
      "superlative": "Superlativ или null",
      "government": [
        {
          "pattern": "полная немецкая конструкция без названия падежа",
          "case": "Akkusativ|Dativ|Genitiv|null",
          "meaning": "краткое объяснение конструкции по-русски"
        }
      ],
      "grammarNotes": [
        { "label": "короткая категория", "value": "краткий полезный факт по-русски" }
      ],
      "examples": [
        { "german": "естественный пример на немецком", "russian": "перевод на русский" },
        { "german": "второй пример на немецком", "russian": "перевод на русский" },
        { "german": "третий пример на немецком", "russian": "перевод на русский" }
      ]
    }
  ]
}
Правила:
- Сначала исправь орфографию исходного текста. correctedInput содержит только исправленный исходный текст, если он отличается хотя бы регистром или буквой; иначе null. Никогда не помещай туда перевод.
- kind="sentence" для полноценного предложения. Для предложения верни только translation, correctedInput при необходимости, пустую explanation и пустой массив entries. Не делай словарный разбор и не создавай примеры.
- kind="term" для одного слова или короткого словарного выражения. Для него верни от одного до трёх entries.
- Первый entry — основное, самое частое значение и должен соответствовать полю translation.
- Добавляй второй или третий entry только для действительно частых самостоятельных значений или частых вариантов перевода. Не добавляй редкие, книжные и устаревшие значения и не заполняй список близкими синонимами ради количества.
- При переводе немецкого слова на русский для разных значений можно повторять немецкое entry.word, но entries[].translation должны ясно и коротко различать русские значения.
- При переводе русского слова на немецкий каждое частое немецкое соответствие оформляй отдельным entry со своей грамматикой.
- Никогда не смешивай разные словарные формы в одном entry. Если пример использует anhalten, festhalten, aufhalten или другой отделяемый/производный глагол, entry.word и infinitive должны содержать именно эту полную форму, а значение должно быть отдельным entry.
- Для частотных многозначных глаголов обязательно показывай 2-3 наиболее полезных значения или устойчивых конструкции. Например, для halten нельзя ограничиваться только «держать»: полезные частые варианты вроде anhalten и an etwas festhalten должны быть отдельными entries, если они используются в примерах.
- Для kind="term" всегда оставляй explanation пустой строкой. Никогда не перечисляй значения предложением и не пиши фразы вроде «глагол имеет несколько значений». Каждое значение должно быть отдельным entry.
- entries[].translation — короткое значение без вводных слов и полного предложения. Допустимо уточнение сферы употребления в скобках: «останавливать (транспорт)», «сохранять (традицию, обещание)».
- Поле translation содержит только один основной естественный перевод на целевом языке. Не повторяй исходное слово, не добавляй тире, слеши, подписи и пояснения.
- Если целевой язык русский, translation никогда не должен начинаться с немецкого артикля der, die или das. Артикль указывай только в немецких словарных данных entry.
- Все explanation и entries[].translation пиши только по-русски.
- Немецкий язык используй только в entries[].word, грамматических формах, government и examples[].german.
- examples[].russian всегда пиши по-русски. Если entry один, дай три коротких разных примера уровня A2-B1. Если entries несколько, дай ровно один пример для каждого entry, показывающий именно его значение. Так общий результат всегда содержит от двух до трёх примеров.
- При переводе с русского на немецкий всегда разбирай ключевые немецкие слова результата.
- Если основной немецкий перевод — существительное, translation обязательно начинай с артикля der, die или das.
- Для немецкого существительного всегда нормализуй entry.word в единственное число и укажи его артикль, даже если пользователь ввёл множественное число. В plural укажи множественное число без артикля die.
- Для глаголов обязательно указывай Infinitiv, Präteritum, Partizip II и haben/sein.
- Для отделяемых и возвратных глаголов показывай полную словарную форму. У отделяемых глаголов указывай корректную форму Präteritum, например "bog ab", и Partizip II.
- government — массив только реально полезных моделей управления. pattern пиши как полную готовую немецкую конструкцию с etwas/jemanden, например "jemanden/etwas halten" или "an etwas festhalten". Не пиши неполное "halten an" и не вставляй название падежа в pattern.
- case указывает падеж отдельно. meaning кратко объясняет по-русски, как пользоваться конструкцией: например "держать кого-то/что-то" или "придерживаться чего-то". Если особого управления нет, верни пустой массив.
- grammarNotes — от одного до четырёх коротких структурированных фактов, которые реально помогают употреблять слово. label — короткая категория вроде "тип", "переходность", "отделяемость", "возвратность" или "особенность"; value — краткое значение по-русски.
- Для глагола укажи, если полезно: сильный/слабый, переходный/непереходный, отделяемый, возвратный. Для существительного — только особый тип склонения или нестандартную форму, если она есть. Для прилагательного — только действительно важную особенность.
- Не повторяй в grammarNotes формы, артикль, множественное число и модели government. Не пиши общие фразы вроде "склоняется по обычному правилу". Если кроме уже показанных данных полезных фактов нет, верни пустой массив.
- explanation всегда оставляй пустой строкой: различия значений передавай только через отдельные entries и короткие уточнения в скобках.
- Не придумывай редкие значения без необходимости.
- JSON должен быть валидным.`;

const translationSchema = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["term", "sentence"] },
    correctedInput: { type: ["string", "null"] },
    translation: { type: "string" },
    explanation: { type: "string" },
    entries: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["noun", "verb", "adjective", "phrase", "other"] },
          word: { type: "string" },
          translation: { type: "string" },
          article: { type: ["string", "null"], enum: ["der", "die", "das", null] },
          plural: { type: ["string", "null"] },
          gender: { type: ["string", "null"], enum: ["maskulin", "feminin", "neutral", null] },
          infinitive: { type: ["string", "null"] },
          preterite: { type: ["string", "null"] },
          participle: { type: ["string", "null"] },
          auxiliary: { type: ["string", "null"], enum: ["haben", "sein", null] },
          comparative: { type: ["string", "null"] },
          superlative: { type: ["string", "null"] },
          government: {
            type: "array",
            maxItems: 3,
            items: {
              type: "object",
              properties: {
                pattern: { type: "string" },
                case: { type: ["string", "null"], enum: ["Akkusativ", "Dativ", "Genitiv", null] },
                meaning: { type: "string" }
              },
              required: ["pattern", "case", "meaning"],
              additionalProperties: false
            }
          },
          grammarNotes: {
            type: "array",
            maxItems: 4,
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                value: { type: "string" }
              },
              required: ["label", "value"],
              additionalProperties: false
            }
          },
          examples: {
            type: "array",
            minItems: 1,
            maxItems: 3,
            items: {
              type: "object",
              properties: {
                german: { type: "string" },
                russian: { type: "string" }
              },
              required: ["german", "russian"],
              additionalProperties: false
            }
          }
        },
        required: [
          "type", "word", "translation", "article", "plural", "gender",
          "infinitive", "preterite", "participle", "auxiliary", "comparative",
          "superlative", "government", "grammarNotes", "examples"
        ],
        additionalProperties: false
      }
    }
  },
  required: ["kind", "correctedInput", "translation", "explanation", "entries"],
  additionalProperties: false
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

type ParsedTranslation = {
  kind?: "term" | "sentence";
  correctedInput?: string | null;
  translation?: string;
  explanation?: string;
  entries?: unknown[];
};

type ModelConfig = {
  id: string;
  output: "strict" | "json";
  reasoningEffort?: "low" | "medium" | "high";
};

const models: ModelConfig[] = [
  { id: "openai/gpt-oss-120b", output: "strict", reasoningEffort: "medium" },
  { id: "llama-3.3-70b-versatile", output: "json" },
  { id: "openai/gpt-oss-20b", output: "strict", reasoningEffort: "medium" }
];

// Cloudflare can reuse a Worker isolate between requests. This small in-memory
// cache lets a warm isolate skip a model until Groq's Retry-After has elapsed.
// A new isolate simply starts with the preferred model again, which is safe.
const modelCooldowns = new Map<string, number>();
const defaultCooldownMs = 10_000;

function modelQueue(now = Date.now()) {
  const ready = models.filter((model) => (modelCooldowns.get(model.id) ?? 0) <= now);
  if (ready.length > 0) return ready;

  // If every model is cooling down, retry the one whose limit resets first.
  return [...models].sort((left, right) => (
    (modelCooldowns.get(left.id) ?? 0) - (modelCooldowns.get(right.id) ?? 0)
  ));
}

function cooldownFrom(response: Response) {
  const seconds = Number.parseFloat(response.headers.get("retry-after") ?? "");
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1_000 : defaultCooldownMs;
}

function responseFormat(model: ModelConfig) {
  if (model.output === "json") return { type: "json_object" };

  return {
    type: "json_schema",
    json_schema: {
      name: "translation_result",
      strict: true,
      schema: translationSchema
    }
  };
}

function normalizedEntry(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const entry = value as Record<string, unknown>;
  const word = typeof entry.word === "string" ? entry.word.trim() : "";
  const translation = typeof entry.translation === "string" ? entry.translation.trim() : "";
  if (!word || !translation) return null;

  const types = new Set(["noun", "verb", "adjective", "phrase", "other"]);
  const articles = new Set(["der", "die", "das"]);
  const genders = new Set(["maskulin", "feminin", "neutral"]);
  const auxiliaries = new Set(["haben", "sein"]);
  const cases = new Set(["Akkusativ", "Dativ", "Genitiv"]);
  const nullableString = (field: unknown) => typeof field === "string" && field.trim() ? field.trim() : null;

  const government = Array.isArray(entry.government)
    ? entry.government.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const rule = item as Record<string, unknown>;
      if (typeof rule.pattern !== "string" || typeof rule.meaning !== "string") return [];
      return [{
        pattern: rule.pattern.trim(),
        case: typeof rule.case === "string" && cases.has(rule.case) ? rule.case : null,
        meaning: rule.meaning.trim()
      }];
    }).slice(0, 3)
    : [];

  const grammarNotes = Array.isArray(entry.grammarNotes)
    ? entry.grammarNotes.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const note = item as Record<string, unknown>;
      if (typeof note.label !== "string" || typeof note.value !== "string") return [];
      return [{ label: note.label.trim(), value: note.value.trim() }];
    }).slice(0, 4)
    : [];

  const examples = Array.isArray(entry.examples)
    ? entry.examples.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const example = item as Record<string, unknown>;
      if (typeof example.german !== "string" || typeof example.russian !== "string") return [];
      return [{ german: example.german.trim(), russian: example.russian.trim() }];
    }).filter((item) => item.german && item.russian).slice(0, 3)
    : [];

  return {
    type: typeof entry.type === "string" && types.has(entry.type) ? entry.type : "other",
    word,
    translation,
    article: typeof entry.article === "string" && articles.has(entry.article) ? entry.article : null,
    plural: nullableString(entry.plural),
    gender: typeof entry.gender === "string" && genders.has(entry.gender) ? entry.gender : null,
    infinitive: nullableString(entry.infinitive),
    preterite: nullableString(entry.preterite),
    participle: nullableString(entry.participle),
    auxiliary: typeof entry.auxiliary === "string" && auxiliaries.has(entry.auxiliary) ? entry.auxiliary : null,
    comparative: nullableString(entry.comparative),
    superlative: nullableString(entry.superlative),
    government,
    grammarNotes,
    examples
  };
}

function normalizedTranslation(value: unknown): ParsedTranslation | null {
  if (!value || typeof value !== "object") return null;
  const parsed = value as Record<string, unknown>;
  if ((parsed.kind !== "term" && parsed.kind !== "sentence") || typeof parsed.translation !== "string") {
    return null;
  }

  return {
    kind: parsed.kind,
    correctedInput: typeof parsed.correctedInput === "string" ? parsed.correctedInput : null,
    translation: parsed.translation.trim(),
    explanation: typeof parsed.explanation === "string" ? parsed.explanation : "",
    entries: Array.isArray(parsed.entries)
      ? parsed.entries.map(normalizedEntry).filter((entry) => entry !== null).slice(0, 3)
      : []
  };
}

function hasExpectedLanguage(value: string, targetLanguage: "ru" | "de") {
  const hasCyrillic = /[А-Яа-яЁё]/.test(value);
  return targetLanguage === "ru" ? hasCyrillic : !hasCyrillic && /[A-Za-zÄÖÜäöüß]/.test(value);
}

function normalizeTranslation(value: string, targetLanguage: "ru" | "de") {
  return targetLanguage === "ru"
    ? value.replace(/^(der|die|das)\s+(?=[А-Яа-яЁё])/i, "").trim()
    : value.trim();
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  try {
    const body = await context.request.json() as Record<string, unknown>;
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const sourceLanguage: "ru" | "de" = /[А-Яа-яЁё]/.test(text) ? "ru" : "de";
    const targetLanguage: "ru" | "de" = sourceLanguage === "ru" ? "de" : "ru";
    const apiKey = (
      context.env.apikey ??
      context.env.APIKEY ??
      context.env.GROQ_API_KEY ??
      ""
    ).trim();
    if (!text) return json({ error: "Введите текст для перевода." }, 400);
    if (!apiKey) return json({ error: "Секрет Groq API не настроен на сервере." }, 500);

    const userPrompt = sourceLanguage === "ru"
      ? `Исходный язык: русский. Целевой язык: немецкий. Переведи и разбери немецкий результат. Все пояснения дай по-русски. Текст: ${text}`
      : `Исходный язык: немецкий. Целевой язык: русский. Переведи и разбери немецкий оригинал. Все пояснения дай по-русски. Текст: ${text}`;

    let rateLimitedModels = 0;
    let shortestRetryMs = Number.POSITIVE_INFINITY;

    for (const model of modelQueue()) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const retryInstruction = attempt === 0 ? "" : targetLanguage === "ru"
          ? "\nКРИТИЧЕСКИ ВАЖНО: предыдущий ответ был отклонён. Верни translation только на русском языке. Для term оставь explanation пустым, а частые значения оформи отдельными entries."
          : "\nКРИТИЧЕСКИ ВАЖНО: предыдущий ответ был отклонён. Верни translation только на немецком языке. Для term оставь explanation пустым, а частые значения оформи отдельными entries.";

        const requestBody: Record<string, unknown> = {
          model: model.id,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `${userPrompt}${retryInstruction}` }
          ],
          max_completion_tokens: 2800,
          response_format: responseFormat(model)
        };
        if (model.reasoningEffort) requestBody.reasoning_effort = model.reasoningEffort;

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(requestBody)
        });

        const payload = await response.json() as {
          error?: { message?: string };
          choices?: Array<{ message?: { content?: string } }>;
        };

        if (response.status === 429) {
          const cooldownMs = cooldownFrom(response);
          modelCooldowns.set(model.id, Date.now() + cooldownMs);
          shortestRetryMs = Math.min(shortestRetryMs, cooldownMs);
          rateLimitedModels += 1;
          break;
        }

        if (!response.ok) {
          return json({ error: payload.error?.message || "Groq API вернул ошибку." }, response.status);
        }

        const outputText = payload.choices?.[0]?.message?.content;
        if (!outputText) continue;

        const cleaned = outputText.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
        let parsed: ParsedTranslation | null = null;
        try {
          parsed = normalizedTranslation(JSON.parse(cleaned));
        } catch {
          continue;
        }
        if (!parsed?.translation) continue;

        parsed.translation = normalizeTranslation(parsed.translation, targetLanguage);
        const validTerm = parsed.kind !== "term" || (
          parsed.entries!.length >= 1 &&
          parsed.entries!.length <= 3 &&
          !parsed.explanation?.trim()
        );

        if (!validTerm || !hasExpectedLanguage(parsed.translation, targetLanguage)) continue;

        if (parsed.kind === "sentence") {
          parsed.entries = [];
        } else if (parsed.entries!.length > 1) {
          parsed.entries = parsed.entries!.map((entry) => {
            const typedEntry = entry as Record<string, unknown>;
            return {
              ...typedEntry,
              examples: Array.isArray(typedEntry.examples) ? typedEntry.examples.slice(0, 1) : []
            };
          });
        }

        parsed.explanation = "";
        modelCooldowns.delete(model.id);

        return json({ ...parsed, sourceLanguage, targetLanguage });
      }
    }

    if (rateLimitedModels > 0) {
      const retrySeconds = Number.isFinite(shortestRetryMs)
        ? Math.max(1, Math.ceil(shortestRetryMs / 1_000))
        : 10;
      return json({
        error: `Все доступные модели временно заняты. Повторите через ${retrySeconds} сек.`
      }, 429);
    }

    return json({ error: "Не удалось получить перевод на нужном языке. Повторите запрос." }, 502);
  } catch (error) {
    const message = error instanceof SyntaxError
      ? "Модель вернула некорректный JSON. Повторите запрос."
      : error instanceof Error ? error.message : "Неизвестная ошибка.";
    return json({ error: message }, 500);
  }
}
