import { LIFE_STAGE_VALUES } from "@/lib/constants";
import { hasRetailerCopy, isOfficialOrPublicUrl } from "@/lib/product-lookup-parse";
import type { NutritionFacts } from "@/lib/product-lookup-parse";

export type GeminiProductFill = {
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

function geminiKey() {
  return (
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    ""
  );
}

export function geminiConfigured() {
  return geminiKey().length > 0;
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

export function parseGeminiProductFill(
  raw: string,
  grounding: { title: string; url: string }[] = [],
  query = "",
): GeminiProductFill | null {
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

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    groundingMetadata?: {
      groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
    };
  }>;
  error?: { message?: string };
};

function groundingSources(data: GeminiResponse): { title: string; url: string }[] {
  const chunks = data.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  return chunks
    .map((chunk) => {
      const url = chunk.web?.uri?.trim();
      const title = chunk.web?.title?.trim() || url;
      if (!url || !title) return null;
      return { title, url };
    })
    .filter((item): item is { title: string; url: string } => Boolean(item));
}

function buildPrompt(query: string, officialExcerpt?: string) {
  return `你是香港寵物食品資料助理。用 Google 搜尋公開資料，為以下商品填欄位。
只使用品牌官網與公開資料，禁止引用任何零售網店（包括 GoGoPet、MegaPet、HKTVmall、Pet in Charge、Vetopia）。
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

async function generateWithModel(model: string, prompt: string, apiKey: string) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.1 },
      }),
      signal: AbortSignal.timeout(20000),
    },
  );
  const data = (await res.json()) as GeminiResponse;
  if (!res.ok) {
    throw new Error(data.error?.message || `Gemini ${model} ${res.status}`);
  }
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n") ?? "";
  return { text, grounding: groundingSources(data) };
}

export async function fillProductWithGemini(input: {
  query: string;
  officialExcerpt?: string;
}): Promise<GeminiProductFill | null> {
  const apiKey = geminiKey();
  if (!apiKey) return null;

  const prompt = buildPrompt(input.query, input.officialExcerpt);
  const models = [
    process.env.GEMINI_MODEL?.trim(),
    "gemini-2.5-flash",
    "gemini-2.0-flash",
  ].filter((value, index, all): value is string => Boolean(value) && all.indexOf(value) === index);

  for (const model of models) {
    try {
      const { text, grounding } = await generateWithModel(model, prompt, apiKey);
      const parsed = parseGeminiProductFill(text, grounding, input.query);
      if (parsed) return parsed;
    } catch {
      continue;
    }
  }
  return null;
}
