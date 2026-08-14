export type SearchHit = {
  title: string;
  url: string;
  snippet: string;
};

export type ParsedProductPage = {
  name?: string;
  brand?: string;
  description?: string;
  imageUrl?: string;
  priceHkdDollars?: string;
};

const AD_HOST_RE =
  /duckduckgo\.com\/y\.js|bing\.com\/aclick|doubleclick\.net|googleadservices|adservice/i;

export function unwrapDuckDuckGoUrl(href: string): string | null {
  try {
    const absolute = href.startsWith("//") ? `https:${href}` : href;
    const parsed = new URL(absolute, "https://duckduckgo.com");
    const raw = parsed.searchParams.get("uddg");
    if (!raw) {
      if (parsed.hostname === "duckduckgo.com") return null;
      return parsed.toString();
    }
    const dest = decodeURIComponent(raw);
    if (AD_HOST_RE.test(dest)) return null;
    return dest;
  } catch {
    return null;
  }
}

function stripTags(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractDuckDuckGoResults(html: string): SearchHit[] {
  const hits: SearchHit[] = [];
  const re = /class="result__a" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(re)) {
    const href = (match[1] ?? "").replace(/&amp;/g, "&");
    const url = unwrapDuckDuckGoUrl(href);
    const title = stripTags(match[2] ?? "");
    if (!url || !title) continue;

    const after = html.slice((match.index ?? 0) + match[0].length, (match.index ?? 0) + match[0].length + 1200);
    const snippetMatch = after.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i);
    const snippet = stripTags(snippetMatch?.[1] ?? "");

    if (hits.some((hit) => hit.url === url)) continue;
    hits.push({ title, url, snippet });
  }

  return hits;
}

export function extractOpenGraph(html: string): ParsedProductPage {
  const attr = (property: string) => {
    const re = new RegExp(
      `property=["']${property}["'][^>]*content=["']([^"']+)["']|content=["']([^"']+)["'][^>]*property=["']${property}["']`,
      "i",
    );
    const match = html.match(re);
    return match?.[1] || match?.[2] || undefined;
  };

  return {
    name: attr("og:title"),
    description: attr("og:description"),
    imageUrl: attr("og:image"),
  };
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object" && "name" in value) {
    return asString((value as { name: unknown }).name);
  }
  if (Array.isArray(value) && value[0]) return asString(value[0]);
  return undefined;
}

export function extractJsonLdProduct(html: string): ParsedProductPage {
  const scripts = [
    ...html.matchAll(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ];

  for (const script of scripts) {
    try {
      const parsed = JSON.parse(script[1] ?? "") as unknown;
      const nodes = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object" && "@graph" in parsed
          ? (parsed as { "@graph": unknown[] })["@graph"]
          : [parsed];

      for (const node of nodes) {
        if (!node || typeof node !== "object") continue;
        const type = (node as { "@type"?: unknown })["@type"];
        const types = Array.isArray(type) ? type : [type];
        if (!types.some((item) => String(item).toLowerCase() === "product")) continue;

        const record = node as Record<string, unknown>;
        const offers = record.offers as Record<string, unknown> | undefined;
        const price = offers?.price != null ? String(offers.price) : undefined;
        const currency = String(offers?.priceCurrency ?? "").toUpperCase();

        return {
          name: asString(record.name),
          brand: asString(record.brand),
          description: asString(record.description),
          imageUrl: asString(record.image),
          priceHkdDollars:
            price && (currency === "HKD" || currency === "HK$")
              ? Number(price).toFixed(2)
              : undefined,
        };
      }
    } catch {
      continue;
    }
  }

  return {};
}

export function extractNutrition(text: string) {
  const numberAfter = (labels: string[]) => {
    for (const label of labels) {
      const re = new RegExp(`${label}[^\\d%]{0,12}([\\d.]+)\\s*%?`, "i");
      const match = text.match(re);
      if (match) return Number(match[1]);
    }
    return undefined;
  };

  const proteinPct = numberAfter(["蛋白質", "crude protein", "protein"]);
  const fatPct = numberAfter(["脂肪", "crude fat", "fat"]);
  const fiberPct = numberAfter(["纖維", "crude fiber", "fibre", "fiber"]);
  const kcalMatch = text.match(
    /(?:kcal(?:\/|每)?\s*100\s*g|熱量)[^\d]{0,12}([\d.]+)/i,
  );
  const kcalPer100g = kcalMatch ? Number(kcalMatch[1]) : undefined;

  return {
    proteinPct: Number.isFinite(proteinPct) ? proteinPct : undefined,
    fatPct: Number.isFinite(fatPct) ? fatPct : undefined,
    fiberPct: Number.isFinite(fiberPct) ? fiberPct : undefined,
    kcalPer100g: Number.isFinite(kcalPer100g) ? kcalPer100g : undefined,
  };
}

export function extractHkdPrice(text: string): string | undefined {
  const match =
    text.match(/HK\$?\s*([\d,]+(?:\.\d{1,2})?)/i) ||
    text.match(/港幣\s*([\d,]+(?:\.\d{1,2})?)/);
  if (!match) return undefined;
  const value = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return value.toFixed(2);
}

export function extractWeightLabel(text: string): string | undefined {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(kg|g|磅|lb)/i);
  if (!match) return undefined;
  return `${match[1]}${match[2].toLowerCase()}`;
}

export function inferSpecies(text: string): string[] {
  const value = text.toLowerCase();
  const found: string[] = [];
  if (/貓|kitten|feline|\bcat\b|\bcats\b/.test(value)) found.push("CAT");
  if (/狗|犬|puppy|canine|\bdog\b|\bdogs\b/.test(value)) found.push("DOG");
  if (/兔|rabbit/.test(value)) found.push("RABBIT");
  if (/鳥|雀|bird|parrot/.test(value)) found.push("BIRD");
  return found;
}

export function inferLifeStages(text: string): string[] {
  const value = text.toLowerCase();
  const found: string[] = [];
  if (/幼犬|puppy/.test(value)) found.push("PUPPY");
  if (/幼貓|kitten/.test(value)) found.push("KITTEN");
  if (/成犬|成貓|adult/.test(value)) found.push("ADULT");
  if (/老年|senior|ageing|aging/.test(value)) found.push("SENIOR");
  if (/全齡|all.?life.?stages|all.?ages/.test(value)) {
    for (const stage of ["PUPPY", "KITTEN", "ADULT", "SENIOR"]) {
      if (!found.includes(stage)) found.push(stage);
    }
  }
  return found;
}

export function inferAllergenIds(
  text: string,
  allergens: { id: string; name: string; nameZh: string | null }[],
): string[] {
  const value = text.toLowerCase();
  return allergens
    .filter((allergen) => {
      const names = [allergen.name, allergen.nameZh].filter(Boolean).map((item) =>
        String(item).toLowerCase(),
      );
      return names.some((name) => name && value.includes(name));
    })
    .map((allergen) => allergen.id);
}

export function inferCategoryId(
  text: string,
  categories: { id: string; name: string; slug?: string }[],
): string | undefined {
  const value = text.toLowerCase();
  const scored = categories
    .map((category) => {
      const hay = `${category.name} ${category.slug ?? ""}`.toLowerCase();
      let score = 0;
      if (hay && value.includes(category.name.toLowerCase())) score += 5;
      if (category.slug && value.includes(category.slug.toLowerCase())) score += 3;
      if (/貓/.test(category.name) && /貓|cat|kitten/.test(value)) score += 2;
      if (/狗/.test(category.name) && /狗|犬|dog|puppy/.test(value)) score += 2;
      if (/糧|food/.test(hay) && /糧|food|kibble|diet/.test(value)) score += 1;
      return { id: category.id, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.id;
}

export const KNOWN_BRANDS = [
  "Royal Canin",
  "Hill's",
  "Hills",
  "Purina",
  "Orijen",
  "Acana",
  "Wellness",
  "Ziwi",
  "Nutro",
  "Iams",
  "Eukanuba",
  "Farmina",
  "Applaws",
  "Sheba",
  "Whiskas",
  "Pedigree",
  "Cesar",
  "PawChoice",
  "OceanPaws",
  "皇家",
  "希爾斯",
  "冠能",
  "渴望",
  "愛肯拿",
];

export function inferBrand(text: string): string | undefined {
  const found = KNOWN_BRANDS.find((brand) =>
    text.toLowerCase().includes(brand.toLowerCase()),
  );
  return found;
}

export function preferOfficialHits(hits: SearchHit[], query: string): SearchHit[] {
  const q = query.toLowerCase();
  const brand = inferBrand(query)?.toLowerCase().replace(/[^a-z0-9]+/g, "") ?? "";

  const score = (hit: SearchHit) => {
    const host = (() => {
      try {
        return new URL(hit.url).hostname.toLowerCase();
      } catch {
        return "";
      }
    })();
    let value = 0;
    if (host.includes("wikipedia.org")) value += 6;
    if (host.includes("openfoodfacts.org")) value += 8;
    if (brand && host.replace(/[^a-z0-9]+/g, "").includes(brand)) value += 10;
    if (/royalcanin|hillspet|purina|orijen|acana|ziwipets/.test(host)) value += 8;
    if (/hktvmall|price\.com\.hk|pethome|petcity/.test(host)) value += 4;
    if (/amazon|facebook|youtube|instagram/.test(host)) value -= 4;
    if (hit.title.toLowerCase().includes(q.slice(0, 12))) value += 2;
    if (/\.pdf($|\?)/i.test(hit.url)) value -= 6;
    return value;
  };

  return [...hits].sort((a, b) => score(b) - score(a));
}

export type ProductLookupResult = {
  name: string;
  slug: string;
  brand: string;
  description: string;
  imageUrl: string;
  categoryId: string;
  proteinPct: string;
  fatPct: string;
  fiberPct: string;
  kcalPer100g: string;
  suitableFor: string[];
  lifeStages: string[];
  allergenIds: string[];
  variantSku: string;
  variantName: string;
  priceDollars: string;
  sources: { title: string; url: string }[];
};

export function suggestedSku(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^\w]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 18)
    .toUpperCase();
  return `PM-${slug || Date.now().toString(36).toUpperCase()}-S`;
}
