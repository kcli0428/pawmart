import { slugify } from "@/lib/utils";
import {
  extractDuckDuckGoResults,
  extractHkdPrice,
  extractIngredients,
  extractJsonLdProduct,
  extractNutrition,
  extractOpenGraph,
  extractPackSizes,
  extractSitemapLocs,
  extractUrlsFromQuery,
  extractWeightLabel,
  htmlToPlainText,
  inferAllergenIds,
  inferBrand,
  inferCategoryId,
  inferLifeStages,
  inferSpecies,
  isGenericBrandCopy,
  preferOfficialHits,
  rankUrlsForQuery,
  scoreProductUrl,
  slugFromProductUrl,
  suggestedSku,
  type NutritionFacts,
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

const BRAND_SITES: Array<{ match: RegExp; host: string }> = [
  { match: /ziwi/i, host: "www.ziwipetshk.com" },
  { match: /royal\s*canin|皇家/i, host: "www.royalcanin.com" },
  { match: /hill'?s|希爾斯/i, host: "www.hillspet.com" },
  { match: /orijen/i, host: "www.orijenpetfoods.com" },
];

async function searchDuckDuckGo(query: string, site?: string): Promise<SearchHit[]> {
  const q = site ? `site:${site} ${query}` : `${query} 官網`;
  const html = await fetchText(
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`,
    10000,
  );
  if (!html) return [];
  return preferOfficialHits(extractDuckDuckGoResults(html), query).slice(0, 10);
}

async function discoverOfficialProductUrls(query: string): Promise<string[]> {
  const known = BRAND_SITES.find((item) => item.match.test(query));
  if (!known) return [];
  const origin = `https://${known.host}`;
  const indexXml = await fetchText(`${origin}/sitemap.xml`, 8000);
  if (!indexXml) return [];

  const locs = extractSitemapLocs(indexXml);
  const pageUrls = locs.filter((url) => !/\.xml(\?|$)/i.test(url));
  const sitemapUrls = locs.filter((url) => /\.xml(\?|$)/i.test(url));
  const preferred = sitemapUrls.filter((url) => /pages-sitemap/i.test(url));
  const others = sitemapUrls.filter((url) => !/pages-sitemap/i.test(url)).slice(0, 2);
  const childXmls = await Promise.all(
    [...preferred, ...others].map((url) => fetchText(url, 8000)),
  );
  for (const xml of childXmls) {
    if (!xml) continue;
    pageUrls.push(...extractSitemapLocs(xml).filter((url) => !/\.xml(\?|$)/i.test(url)));
  }
  return rankUrlsForQuery(pageUrls, query).slice(0, 3);
}

async function gatherSearchHits(query: string): Promise<SearchHit[]> {
  const known = BRAND_SITES.find((item) => item.match.test(query));
  const [hits, siteHits, sitemapUrls] = await Promise.all([
    searchDuckDuckGo(query),
    known ? searchDuckDuckGo(query, known.host) : Promise.resolve([] as SearchHit[]),
    discoverOfficialProductUrls(query),
  ]);
  const sitemapHits: SearchHit[] = sitemapUrls.map((url) => ({
    title: "品牌官網商品頁",
    url,
    snippet: query,
  }));
  return preferOfficialHits([...sitemapHits, ...siteHits, ...hits], query);
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
  const html = await fetchText(url, 12000);
  if (!html) return null;
  const text = htmlToPlainText(html);
  const jsonLd = extractJsonLdProduct(html);
  const og = extractOpenGraph(html);
  const nutrition = extractNutrition(text);
  const ingredients = extractIngredients(text);
  return {
    name: jsonLd.name || og.name,
    brand: jsonLd.brand,
    description: jsonLd.description || og.description,
    imageUrl: jsonLd.imageUrl || og.imageUrl,
    priceHkdDollars: jsonLd.priceHkdDollars || extractHkdPrice(text),
    ingredients,
    nutrition,
    packSizes: extractPackSizes(`${og.name ?? ""} ${text.slice(0, 4000)}`),
    text,
    url,
  };
}

function mergeNutrition(...parts: Array<NutritionFacts | undefined>): NutritionFacts {
  const merged: NutritionFacts = {};
  for (const part of parts) {
    if (!part) continue;
    for (const [key, value] of Object.entries(part) as [keyof NutritionFacts, number | undefined][]) {
      if (merged[key] == null && value != null) merged[key] = value;
    }
  }
  return merged;
}

function productDescription(input: {
  query: string;
  ingredients?: string;
  pageDescription?: string;
  wiki?: string;
}) {
  const page =
    input.pageDescription && !isGenericBrandCopy(input.pageDescription, input.query)
      ? input.pageDescription
      : undefined;
  const blocks = [
    page,
    input.ingredients ? `主要成份：${input.ingredients}` : undefined,
  ].filter(Boolean);
  if (blocks.length > 0) return blocks.join("\n\n");
  return input.wiki ?? "";
}

function firstText(...values: Array<string | undefined>) {
  return values.find((value) => value && value.trim())?.trim() ?? "";
}

function formatNum(value: number | undefined) {
  return value == null ? "" : String(value);
}

function nutritionFieldCount(nutrition: NutritionFacts) {
  return Object.values(nutrition).filter((value) => value != null).length;
}

export async function lookupProduct(
  input: ProductLookupInput,
): Promise<ProductLookupResult | null> {
  const query = input.query.trim();
  if (query.length < 2) return null;

  const [ddgHits, wikiZh, wikiEn, off] = await Promise.all([
    gatherSearchHits(query),
    searchWikipedia(query, "zh"),
    searchWikipedia(query, "en"),
    searchOpenFoodFacts(query),
  ]);

  const pagesToFetch = [...new Set([...extractUrlsFromQuery(query), ...ddgHits.map((hit) => hit.url)])]
    .filter((url) => !/\.pdf($|\?)/i.test(url))
    .slice(0, 8);

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
    ...scraped.flatMap((page) => [page.name, page.brand, page.description, page.ingredients, page.text?.slice(0, 2500)]),
  ]
    .filter(Boolean)
    .join("\n");

  const officialPage = [...scraped]
    .map((page) => ({
      page,
      score:
        nutritionFieldCount(page.nutrition) * 3 +
        (page.ingredients ? 8 : 0) +
        scoreProductUrl(page.url, query),
    }))
    .sort((a, b) => b.score - a.score)[0]?.page;
  const pageNutrition = officialPage?.nutrition;
  const parsedFromOfficial = officialPage?.text
    ? extractNutrition(officialPage.text)
    : undefined;
  const nutrition = mergeNutrition(
    parsedFromOfficial,
    pageNutrition,
    extractNutrition(officialPage?.text ?? ""),
    extractNutrition(combinedText),
    {
      proteinPct: off?.proteinPct,
      fatPct: off?.fatPct,
      fiberPct: off?.fiberPct,
      kcalPer100g: off?.kcalPer100g,
    },
  );

  const name = query;

  const brand = firstText(
    officialPage?.brand,
    scraped.find((page) => page.brand)?.brand,
    off?.brand,
    inferBrand(query),
    inferBrand(combinedText),
  );
  const ingredients =
    officialPage?.ingredients ||
    scraped.find((page) => page.ingredients)?.ingredients ||
    extractIngredients(combinedText) ||
    "";
  const description = productDescription({
    query,
    ingredients,
    pageDescription: firstText(
      officialPage?.description && !isGenericBrandCopy(officialPage.description, query)
        ? officialPage.description
        : undefined,
      officialPage?.name && /配方|貓糧|狗糧|cat|dog/i.test(officialPage.name)
        ? officialPage.name
        : undefined,
    ),
    wiki: wiki?.description,
  });
  const imageUrl = firstText(
    officialPage?.imageUrl,
    scraped.find((page) => page.imageUrl)?.imageUrl,
    off?.imageUrl,
    wiki?.imageUrl,
  );
  const priceDollars = firstText(
    officialPage?.priceHkdDollars,
    scraped.find((page) => page.priceHkdDollars)?.priceHkdDollars,
    extractHkdPrice(combinedText),
  );
  const packSizes =
    officialPage?.packSizes?.length
      ? officialPage.packSizes
      : extractPackSizes(`${query} ${combinedText}`);
  const weight = packSizes[0] ?? extractWeightLabel(`${query} ${name} ${combinedText}`);
  const querySpecies = inferSpecies(query);
  const queryStages = inferLifeStages(query);
  const species = querySpecies.length ? querySpecies : inferSpecies(combinedText);
  const lifeStages = queryStages;

  const sources: { title: string; url: string }[] = [];
  if (officialPage) {
    sources.push({
      title: officialPage.name || "品牌官網商品頁",
      url: officialPage.url,
    });
  }
  if (wiki) sources.push({ title: `Wikipedia：${wiki.title}`, url: wiki.url });
  if (off) sources.push({ title: "Open Food Facts", url: off.url });
  for (const hit of ddgHits.slice(0, 3)) {
    if (!sources.some((source) => source.url === hit.url)) {
      sources.push({ title: hit.title, url: hit.url });
    }
  }

  const slug =
    (officialPage && slugFromProductUrl(officialPage.url)) ||
    slugify(brand) ||
    slugify(name) ||
    `product-${Date.now().toString(36)}`;

  return {
    name,
    slug,
    brand,
    description,
    imageUrl,
    categoryId: inferCategoryId(query, combinedText, input.categories) ?? "",
    proteinPct: formatNum(nutrition.proteinPct),
    fatPct: formatNum(nutrition.fatPct),
    fiberPct: formatNum(nutrition.fiberPct),
    kcalPer100g: formatNum(nutrition.kcalPer100g),
    moisturePct: formatNum(nutrition.moisturePct),
    ashPct: formatNum(nutrition.ashPct),
    taurinePct: formatNum(nutrition.taurinePct),
    chondroitinMgPerKg: formatNum(nutrition.chondroitinMgPerKg),
    glucosamineMgPerKg: formatNum(nutrition.glucosamineMgPerKg),
    ingredients,
    suitableFor: species,
    lifeStages,
    allergenIds: inferAllergenIds(ingredients || query, input.allergens),
    variantSku: suggestedSku(brand || slug || name),
    variantName: weight ? `${weight} 裝` : "標準裝",
    packSizes,
    priceDollars,
    sources,
  };
}
