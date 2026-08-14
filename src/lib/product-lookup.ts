import { slugify } from "@/lib/utils";
import {
  extractDuckDuckGoResults,
  extractHkdPrice,
  extractJsonLdProduct,
  extractNutrition,
  extractOpenGraph,
  extractWeightLabel,
  inferAllergenIds,
  inferBrand,
  inferCategoryId,
  inferLifeStages,
  inferSpecies,
  preferOfficialHits,
  suggestedSku,
  type SearchHit,
  type ProductLookupResult,
} from "@/lib/product-lookup-parse";

export type ProductLookupInput = {
  query: string;
  categories: { id: string; name: string; slug?: string }[];
  allergens: { id: string; name: string; nameZh: string | null }[];
};

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
};

async function fetchText(url: string, timeoutMs = 8000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function fetchJson<T>(url: string, timeoutMs = 8000): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function searchDuckDuckGo(query: string): Promise<SearchHit[]> {
  const html = await fetchText(
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`${query} 寵物 官網 pet food official`)}`,
  );
  if (!html) return [];
  return preferOfficialHits(extractDuckDuckGoResults(html), query).slice(0, 8);
}

type WikiSearch = {
  query?: { search?: { title: string; snippet: string }[] };
};

type WikiExtract = {
  query?: {
    pages?: Record<
      string,
      { title?: string; extract?: string; thumbnail?: { source?: string } }
    >;
  };
};

async function searchWikipedia(query: string, lang: "zh" | "en") {
  const search = await fetchJson<WikiSearch>(
    `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=3&format=json`,
  );
  const first = search?.query?.search?.[0];
  if (!first?.title) return null;
  if (/mounted police|air force|navy|disambiguation/i.test(first.title)) return null;

  const extract = await fetchJson<WikiExtract>(
    `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts|pageimages&exintro=1&explaintext=1&piprop=thumbnail&pithumbsize=800&titles=${encodeURIComponent(first.title)}&format=json`,
  );
  const page = Object.values(extract?.query?.pages ?? {})[0];
  if (!page?.extract) return null;

  return {
    title: page.title ?? first.title,
    description: page.extract.slice(0, 600),
    imageUrl: page.thumbnail?.source,
    url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent((page.title ?? first.title).replace(/ /g, "_"))}`,
  };
}

type OffSearch = {
  products?: Array<{
    product_name?: string;
    brands?: string;
    image_url?: string;
    generic_name?: string;
    ingredients_text?: string;
    categories_tags?: string[];
    nutriments?: Record<string, number | string>;
  }>;
};

function offNumber(nutriments: Record<string, number | string> | undefined, key: string) {
  const value = nutriments?.[key];
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

async function searchOpenFoodFacts(query: string) {
  const urls = [
    `https://world.openfoodfacts.org/cgi/search.pl?action=process&search_terms=${encodeURIComponent(query)}&tagtype_0=categories&tag_contains_0=contains&tag_0=pet-food&json=1&page_size=5`,
    `https://world.openfoodfacts.org/cgi/search.pl?action=process&search_terms=${encodeURIComponent(query)}&json=1&page_size=5`,
  ];

  for (const url of urls) {
    const data = await fetchJson<OffSearch>(url);
    const product = data?.products?.find((item) => item.product_name);
    if (!product) continue;
    const nutriments = product.nutriments ?? {};
    return {
      name: product.product_name,
      brand: product.brands?.split(",")[0]?.trim(),
      description: product.generic_name || product.ingredients_text || "",
      imageUrl: product.image_url,
      proteinPct: offNumber(nutriments, "proteins_100g"),
      fatPct: offNumber(nutriments, "fat_100g"),
      fiberPct: offNumber(nutriments, "fiber_100g"),
      kcalPer100g: offNumber(nutriments, "energy-kcal_100g"),
      categories: (product.categories_tags ?? []).join(" "),
      url: "https://world.openfoodfacts.org",
    };
  }

  return null;
}

async function scrapeProductPage(url: string) {
  const html = await fetchText(url);
  if (!html) return null;
  const jsonLd = extractJsonLdProduct(html);
  const og = extractOpenGraph(html);
  const nutrition = extractNutrition(html);
  return {
    name: jsonLd.name || og.name,
    brand: jsonLd.brand,
    description: jsonLd.description || og.description,
    imageUrl: jsonLd.imageUrl || og.imageUrl,
    priceHkdDollars: jsonLd.priceHkdDollars || extractHkdPrice(html),
    nutrition,
    url,
  };
}

function firstText(...values: Array<string | undefined>) {
  return values.find((value) => value && value.trim())?.trim() ?? "";
}

function formatNum(value: number | undefined) {
  return value == null ? "" : String(value);
}

export async function lookupProduct(
  input: ProductLookupInput,
): Promise<ProductLookupResult | null> {
  const query = input.query.trim();
  if (query.length < 2) return null;

  const [ddgHits, wikiZh, wikiEn, off] = await Promise.all([
    searchDuckDuckGo(query),
    searchWikipedia(query, "zh"),
    searchWikipedia(query, "en"),
    searchOpenFoodFacts(query),
  ]);

  const pagesToFetch = ddgHits
    .map((hit) => hit.url)
    .filter((url) => !/\.pdf($|\?)/i.test(url))
    .slice(0, 3);

  const scraped = (
    await Promise.all(pagesToFetch.map((url) => scrapeProductPage(url)))
  ).filter((item): item is NonNullable<typeof item> => Boolean(item));

  const wiki = wikiZh ?? wikiEn;
  const combinedText = [
    query,
    wiki?.title,
    wiki?.description,
    off?.name,
    off?.brand,
    off?.description,
    off?.categories,
    ...ddgHits.flatMap((hit) => [hit.title, hit.snippet]),
    ...scraped.flatMap((page) => [page.name, page.brand, page.description]),
  ]
    .filter(Boolean)
    .join("\n");

  const parsedNutrition = extractNutrition(combinedText);
  const pageNutrition = scraped.find(
    (page) =>
      page.nutrition.proteinPct != null ||
      page.nutrition.fatPct != null ||
      page.nutrition.kcalPer100g != null,
  )?.nutrition;
  const offNutrition = {
    proteinPct: off?.proteinPct ?? pageNutrition?.proteinPct ?? parsedNutrition.proteinPct,
    fatPct: off?.fatPct ?? pageNutrition?.fatPct ?? parsedNutrition.fatPct,
    fiberPct: off?.fiberPct ?? pageNutrition?.fiberPct ?? parsedNutrition.fiberPct,
    kcalPer100g:
      off?.kcalPer100g ?? pageNutrition?.kcalPer100g ?? parsedNutrition.kcalPer100g,
  };

  const name = query;

  const brand = firstText(
    scraped.find((page) => page.brand)?.brand,
    off?.brand,
    inferBrand(combinedText),
    inferBrand(query),
  );
  const description = firstText(
    scraped.find((page) => page.description && page.description.length > 40)
      ?.description,
    wiki?.description,
    off?.description,
    ddgHits[0]?.snippet,
  );
  const imageUrl = firstText(
    scraped.find((page) => page.imageUrl)?.imageUrl,
    off?.imageUrl,
    wiki?.imageUrl,
  );
  const priceDollars = firstText(
    scraped.find((page) => page.priceHkdDollars)?.priceHkdDollars,
    extractHkdPrice(combinedText),
  );
  const weight = extractWeightLabel(`${query} ${name} ${combinedText}`);
  const querySpecies = inferSpecies(query);
  const queryStages = inferLifeStages(query);
  const species = querySpecies.length ? querySpecies : inferSpecies(combinedText);
  const lifeStages = queryStages.length ? queryStages : inferLifeStages(combinedText);

  const sources: { title: string; url: string }[] = [];
  if (wiki) sources.push({ title: `Wikipedia：${wiki.title}`, url: wiki.url });
  if (off) sources.push({ title: "Open Food Facts", url: off.url });
  for (const hit of ddgHits.slice(0, 3)) {
    if (!sources.some((source) => source.url === hit.url)) {
      sources.push({ title: hit.title, url: hit.url });
    }
  }

  const englishSlugSource =
    wikiEn?.title || scraped.find((page) => page.name)?.name || brand || name;
  const slug = slugify(englishSlugSource) || slugify(brand) || slugify(name);

  return {
    name,
    slug,
    brand,
    description,
    imageUrl,
    categoryId: inferCategoryId(`${query}\n${combinedText}`, input.categories) ?? "",
    proteinPct: formatNum(offNutrition.proteinPct),
    fatPct: formatNum(offNutrition.fatPct),
    fiberPct: formatNum(offNutrition.fiberPct),
    kcalPer100g: formatNum(offNutrition.kcalPer100g),
    suitableFor: species,
    lifeStages,
    allergenIds: inferAllergenIds(combinedText, input.allergens),
    variantSku: suggestedSku(brand || englishSlugSource || name),
    variantName: weight ? `${weight} 裝` : "標準裝",
    priceDollars,
    sources,
  };
}
