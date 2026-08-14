import { LIFE_STAGE_VALUES, SITE_NAME } from "@/lib/constants";
import { hasRetailerCopy, isOfficialOrPublicUrl } from "@/lib/product-lookup-parse";
import type { NutritionFacts } from "@/lib/product-lookup-parse";

export type ProductFill = {
  brand?: string;
  description?: string;
  ingredients?: string;
  nutrition: NutritionFacts;
  suitableFor: string[];
  lifeStages: string[];
  sources: { title: string; url: string }[];
};

const SPECIES = new Set(["DOG", "CAT", "BIRD", "RABBIT", "OTHER"]);
const LIFE_STAGES = new Set<string>(LIFE_STAGE_VALUES);

const EXCLUDED_SEARCH_DOMAINS = [
  "gogopet.com.hk",
  "megapet.com.hk",
  "hktvmall.com",
  "openfoodfacts.org",
  "world.openfoodfacts.org",
  "petincharge.com",
  "vetopia.com.hk",
  "amazon.com",
  "shopee.hk",
  "lazada.com.hk",
];

function openRouterKey() {
  return process.env.OPENROUTER_API_KEY?.trim() || "";
}

export function openRouterConfigured() {
  return openRouterKey().length > 0;
}

function asNum(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.replace(/,/g, ""));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function asText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.replace(/\s+/g, " ").trim();
  if (!text || text === "null" || hasRetailerCopy(text)) return undefined;
  return text;
}

export function extractJsonObject(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = (fenced ?? raw).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function citationsFromAnnotations(
  annotations: unknown,
  query = "",
): { title: string; url: string }[] {
  if (!Array.isArray(annotations)) return [];
  return annotations
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as {
        type?: unknown;
        url?: unknown;
        title?: unknown;
        url_citation?: { url?: unknown; title?: unknown };
      };
      const citation = row.url_citation;
      const url = asText(typeof citation?.url === "string" ? citation.url : row.url);
      const title =
        asText(typeof citation?.title === "string" ? citation.title : row.title) || url;
      if (!url || !title || !isOfficialOrPublicUrl(url, query)) return null;
      return { title, url };
    })
    .filter((item): item is { title: string; url: string } => Boolean(item));
}

export function parseProductFill(
  raw: string,
  grounding: { title: string; url: string }[] = [],
  query = "",
): ProductFill | null {
  const parsed = extractJsonObject(raw);
  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed as Record<string, unknown>;
  const suitableFor = Array.isArray(record.suitableFor)
    ? record.suitableFor.map(String).filter((value) => SPECIES.has(value))
    : [];
  const lifeStages = Array.isArray(record.lifeStages)
    ? record.lifeStages.map(String).filter((value) => LIFE_STAGES.has(value))
    : [];
  const sources = [
    ...grounding,
    ...(Array.isArray(record.sources) ? record.sources : []),
  ]
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as { title?: unknown; url?: unknown };
      const url = asText(row.url);
      const title = asText(row.title) || url;
      if (!url || !title || !isOfficialOrPublicUrl(url, query)) return null;
      return { title, url };
    })
    .filter((item): item is { title: string; url: string } => Boolean(item));

  return {
    brand: asText(record.brand),
    description: asText(record.description),
    ingredients: asText(record.ingredients),
    nutrition: {
      proteinPct: asNum(record.proteinPct),
      fatPct: asNum(record.fatPct),
      fiberPct: asNum(record.fiberPct),
      moisturePct: asNum(record.moisturePct),
      ashPct: asNum(record.ashPct),
      taurinePct: asNum(record.taurinePct),
      kcalPer100g: asNum(record.kcalPer100g),
    },
    suitableFor,
    lifeStages,
    sources,
  };
}

type OpenRouterMessage = {
  content?: unknown;
  annotations?: unknown;
};

type OpenRouterResponse = {
  choices?: Array<{ message?: OpenRouterMessage }>;
  error?: { message?: string; code?: number | string };
};

function messageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "text" in part) {
        return String((part as { text?: unknown }).text ?? "");
      }
      return "";
    })
    .join("\n");
}

function buildPrompt(query: string, officialExcerpt?: string) {
  return `你是香港寵物食品資料助理。用網上搜尋公開資料，為以下商品填欄位。
只使用品牌官網與公開資料，禁止引用任何零售網店（包括 GoGoPet、MegaPet、HKTVmall、Pet in Charge、Vetopia）。
禁止使用 Open Food Facts。
描述與成份必須是繁體中文，不要出現店舖名稱或浮水印圖網址。
不確定的數字請用 null，不要捏造。

商品名稱：${query}
官網摘錄：${officialExcerpt?.slice(0, 2500) || "無"}

只回傳一個 JSON 物件：
{
  "brand": string | null,
  "description": string | null,
  "ingredients": string | null,
  "proteinPct": number | null,
  "fatPct": number | null,
  "fiberPct": number | null,
  "moisturePct": number | null,
  "ashPct": number | null,
  "taurinePct": number | null,
  "kcalPer100g": number | null,
  "suitableFor": ["CAT"|"DOG"|"BIRD"|"RABBIT"|"OTHER"],
  "lifeStages": ["PUPPY"|"KITTEN"|"ADULT_DOG"|"ADULT_CAT"|"SENIOR_DOG"|"SENIOR_CAT"],
  "sources": [{"title": string, "url": string}]
}`;
}

function isFreeModel(model: string) {
  return /:free\b|\/free$/i.test(model);
}

function requestAttempts(model: string): Array<{ tools: boolean; json: boolean }> {
  if (isFreeModel(model)) {
    return [{ tools: false, json: true }];
  }
  return [
    { tools: true, json: true },
    { tools: false, json: true },
  ];
}

async function generateWithModel(
  model: string,
  prompt: string,
  apiKey: string,
  options: { tools: boolean; json: boolean },
) {
  const referer = process.env.AUTH_URL?.trim() || "https://pawmart.hk";
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": referer,
          "X-Title": SITE_NAME,
        },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          ...(options.json ? { response_format: { type: "json_object" } } : {}),
          messages: [{ role: "user", content: prompt }],
          ...(options.tools
            ? {
                tools: [
                  {
                    type: "openrouter:web_search",
                    parameters: {
                      engine: "auto",
                      max_results: 8,
                      max_uses: 2,
                      excluded_domains: EXCLUDED_SEARCH_DOMAINS,
                    },
                  },
                ],
              }
            : {}),
        }),
        signal: AbortSignal.timeout(35000),
      });
      const data = (await res.json()) as OpenRouterResponse;
      const transient =
        data.error?.code === 502 ||
        data.error?.code === 503 ||
        /internal server error|temporarily|overloaded/i.test(data.error?.message ?? "");
      if (transient && attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        lastError = new Error(data.error?.message || `OpenRouter ${model} ${res.status}`);
        continue;
      }
      if (!res.ok || data.error) {
        throw new Error(data.error?.message || `OpenRouter ${model} ${res.status}`);
      }
      const message = data.choices?.[0]?.message;
      const text = messageText(message?.content);
      if (!text.trim()) throw new Error(`OpenRouter ${model} returned empty content`);
      return {
        text,
        annotations: message?.annotations,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const timeout = lastError.name === "TimeoutError" || /aborted due to timeout/i.test(lastError.message);
      if (timeout || attempt >= 2) throw lastError;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }

  throw lastError ?? new Error(`OpenRouter ${model} failed`);
}

export async function fillProductWithOpenRouter(input: {
  query: string;
  officialExcerpt?: string;
}): Promise<ProductFill | null> {
  const apiKey = openRouterKey();
  if (!apiKey) return null;

  const prompt = buildPrompt(input.query, input.officialExcerpt);
  const configured = process.env.OPENROUTER_MODEL?.trim();
  const models = [
    configured,
    ...(configured && isFreeModel(configured)
      ? []
      : ["google/gemini-2.5-flash", "google/gemini-flash-1.5"]),
  ].filter((value, index, all): value is string => Boolean(value) && all.indexOf(value) === index);

  for (const model of models) {
    for (const attempt of requestAttempts(model)) {
      try {
        const { text, annotations } = await generateWithModel(model, prompt, apiKey, attempt);
        const parsed = parseProductFill(
          text,
          citationsFromAnnotations(annotations, input.query),
          input.query,
        );
        if (parsed) return parsed;
      } catch {
        continue;
      }
    }
  }
  return null;
}
