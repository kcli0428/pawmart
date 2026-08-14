import { slugify } from "@/lib/utils";
import { spawn } from "node:child_process";
import {
  extractDuckDuckGoResults,
  extractHkdPrice,
  extractHtmlImages,
  extractIngredientAlts,
  extractIngredientImageUrls,
  extractIngredients,
  extractJsonLdProduct,
  extractOpenGraph,
  extractPackSizes,
  extractProductHighlights,
  extractSitemapLocs,
  extractUrlsFromQuery,
  extractWeightLabel,
  htmlToPlainText,
  inferAllergenIds,
  inferBrand,
  inferCategoryId,
  inferLifeStages,
  inferSpecies,
  isCatalogNoise,
  isGenericBrandCopy,
  looksLikeIngredientList,
  nutritionFromPage,
  pickProductImage,
  preferOfficialHits,
  rankUrlsForQuery,
  refineIngredients,
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
  { match: /astkatta/i, host: "www.astkatta.com" },
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

  const locs = extractSitemapLocs(indexXml ?? "");
  const pageUrls = locs.filter((url) => !/\.xml(\?|$)/i.test(url));
  const sitemapUrls = locs.filter((url) => /\.xml(\?|$)/i.test(url));
  const preferred = sitemapUrls.filter((url) => /pages-sitemap|product/i.test(url));
  const fallback = [`${origin}/pages-sitemap.xml`, `${origin}/store-products-sitemap.xml`];
  const others = sitemapUrls.filter((url) => !preferred.includes(url)).slice(0, 2);
  const childXmls = await Promise.all(
    [...new Set([...preferred, ...fallback, ...others])].map((url) => fetchText(url, 8000)),
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

async function ocrImageUrl(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return undefined;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 20_000 || buffer.length > 4_000_000) return undefined;
    const text = await new Promise<string>((resolve, reject) => {
      const child = spawn("tesseract", ["stdin", "stdout", "-l", "eng", "--psm", "6"], {
        timeout: 8000,
      });
      let out = "";
      child.stdout.on("data", (chunk) => {
        out += String(chunk);
      });
      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) resolve(out);
        else reject(new Error("ocr failed"));
      });
      child.stdin.end(buffer);
    });
    const cleaned = text.replace(/\s+/g, " ").trim();
    return looksLikeIngredientList(cleaned) ? cleaned : undefined;
  } catch {
    return undefined;
  }
}

async function scrapeProductPage(url: string, query: string) {
  const html = await fetchText(url, 12000);
  if (!html) return null;
  const text = htmlToPlainText(html);
  const jsonLd = extractJsonLdProduct(html);
  const og = extractOpenGraph(html);
  const images = extractHtmlImages(html);
  const nutrition = nutritionFromPage(text);
  let ingredients = extractIngredients(text) || extractIngredientAlts(html);
  let ingredientNote: string | undefined;
  if (!ingredients || ingredients.length < 12) {
    const ocrText = (
      await Promise.all(extractIngredientImageUrls(html).slice(0, 2).map(ocrImageUrl))
    ).find(Boolean);
    if (ocrText) {
      ingredients = ocrText;
      ingredientNote = "已從官網成份圖片辨識文字。";
    } else if (extractIngredientImageUrls(html).length > 0) {
      ingredientNote =
        "官網成份是插圖／照片而非文字表，無法自動讀出完整配方；已依圖片標示或品名填入主要成份。";
    }
  }
  return {
    name: jsonLd.name || og.name,
    brand: jsonLd.brand,
    description: jsonLd.description || og.description,
    imageUrl:
      pickProductImage(images, query) || jsonLd.imageUrl || og.imageUrl,
    priceHkdDollars: jsonLd.priceHkdDollars || extractHkdPrice(text),
    ingredients,
    ingredientNote,
    highlights: extractProductHighlights(text),
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

function usableCopy(text: string | undefined, query: string): string | undefined {
  if (!text) return undefined;
  const value = text.replace(/\s*\|\s*www\.[^\s|]+/gi, "").trim();
  if (!value || isCatalogNoise(value) || isGenericBrandCopy(value, query)) return undefined;
  if (/^https?:\/\//i.test(value)) return undefined;
  return value;
}

function productDescription(input: {
  query: string;
  ingredients?: string;
  highlights?: string;
  pageDescription?: string;
  wiki?: string;
}) {
  const ingredients =
    input.ingredients && !isCatalogNoise(input.ingredients)
      ? `主要成份：${input.ingredients}`
      : undefined;
  const blocks = [
    usableCopy(input.highlights, input.query),
    usableCopy(input.pageDescription, input.query),
    ingredients,
  ].filter(Boolean);
  if (blocks.length > 0) return [...new Set(blocks)].join("\n\n");
  return usableCopy(input.wiki, input.query) ?? "";
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
    await Promise.all(pagesToFetch.map((url) => scrapeProductPage(url, query)))
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
  const officialHasNutrition = nutritionFieldCount(officialPage?.nutrition ?? {}) >= 3;
  const nutrition = officialHasNutrition
    ? (officialPage?.nutrition ?? {})
    : mergeNutrition(officialPage?.nutrition, nutritionFromPage(combinedText), {
        proteinPct: off?.proteinPct,
        fatPct: off?.fatPct,
        fiberPct: off?.fiberPct,
        kcalPer100g: off?.kcalPer100g,
      });

  const name = query;

  const brand = firstText(
    officialPage?.brand,
    scraped.find((page) => page.brand)?.brand,
    off?.brand,
    inferBrand(query),
    inferBrand(combinedText),
  );
  const ingredients = refineIngredients(
    [
      officialPage?.ingredients,
      scraped.find((page) => page.ingredients && !isCatalogNoise(page.ingredients))?.ingredients,
      extractIngredients(combinedText),
    ].find((value) => value && !isCatalogNoise(value)),
    query,
  );
  const description = productDescription({
    query,
    ingredients,
    highlights: officialPage?.highlights,
    pageDescription: officialPage?.description,
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
  const lifeStages = queryStages.length
    ? queryStages
    : inferLifeStages(`${query}\n${officialPage?.highlights ?? ""}`);

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
    notes: [officialPage?.ingredientNote].filter((note): note is string => Boolean(note)),
  };
}
