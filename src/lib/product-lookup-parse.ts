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

export type NutritionFacts = {
  proteinPct?: number;
  fatPct?: number;
  fiberPct?: number;
  moisturePct?: number;
  ashPct?: number;
  taurinePct?: number;
  kcalPer100g?: number;
  chondroitinMgPerKg?: number;
  glucosamineMgPerKg?: number;
};

export type HtmlImage = {
  url: string;
  alt: string;
  width: number;
};

const PUBLIC_HOST_RE = /(?:^|\.)(?:wikipedia\.org|wikimedia\.org|openfoodfacts\.org)$/i;

const OFFICIAL_BRAND_HOSTS = [
  "astkatta.com",
  "ziwipetshk.com",
  "ziwi.com",
  "ziwipets.com",
  "royalcanin.com",
  "hillspet.com",
  "purina.com",
  "orijenpetfoods.com",
  "orijen.com",
  "acana.com",
  "wellnesspetfood.com",
];

const RETAILER_HOST_RE =
  /gogopet|megapet|petincharge|vetopia|hktvmall|price\.com\.hk|pethome|petcity|hkdog|a-pets|spca\.org|amazon|shopee|lazada|taobao|tmall|facebook|instagram|pethouse|petpet|pawfect/i;

const RETAILER_COPY_RE =
  /gogopet|mega\s*pet|pet in charge|petincharge|vetopia|hktvmall|天下貓貓|petpethome|petwise|price\.com\.hk|pethome|petcity/i;

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function isRetailerUrl(url: string): boolean {
  return RETAILER_HOST_RE.test(hostnameOf(url)) || RETAILER_HOST_RE.test(url);
}

export function isOfficialOrPublicUrl(url: string, query = ""): boolean {
  const host = hostnameOf(url);
  if (!host || isRetailerUrl(url)) return false;
  if (PUBLIC_HOST_RE.test(host)) return true;
  if (OFFICIAL_BRAND_HOSTS.some((item) => host === item || host.endsWith(`.${item}`))) return true;
  const brand = inferBrand(query)?.toLowerCase().replace(/[^a-z0-9]+/g, "") ?? "";
  if (brand.length >= 4 && host.replace(/[^a-z0-9]+/g, "").includes(brand)) return true;
  return false;
}

export function hasRetailerCopy(text: string): boolean {
  return RETAILER_COPY_RE.test(text);
}

function decodeHtmlAttr(value: string) {
  return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"');
}

export function extractHtmlImages(html: string): HtmlImage[] {
  const images: HtmlImage[] = [];
  for (const tag of html.matchAll(/<img\b[^>]*>/gi)) {
    const raw = tag[0];
    const alt = decodeHtmlAttr(raw.match(/\balt=["']([^"']*)["']/i)?.[1] ?? "");
    const src = decodeHtmlAttr(raw.match(/\bsrc=["']([^"']+)["']/i)?.[1] ?? "");
    const srcset = decodeHtmlAttr(raw.match(/\bsrcset=["']([^"']+)["']/i)?.[1] ?? "");
    const widthAttr = Number(raw.match(/\bwidth=["'](\d+)/i)?.[1] ?? 0);
    const urls = [
      src,
      ...srcset
        .split(",")
        .map((part) => part.trim().split(/\s+/)[0] ?? "")
        .filter(Boolean),
    ];
    for (const url of urls) {
      if (!/^https?:\/\//i.test(url)) continue;
      const fromPath = Number(url.match(/(?:\/fill\/w_|[?&]w=)(\d+)/i)?.[1] ?? 0);
      images.push({ url, alt, width: Math.max(fromPath, widthAttr, 0) });
    }
  }
  return images;
}

export function normalizeCdnImageUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("wixstatic.com")) return url;
    const media = `${parsed.origin}${parsed.pathname.replace(/\/v1\/.*$/, "")}`;
    return `${media}/v1/fill/w_1200,h_900,al_c,q_85,enc_auto/product.jpg`;
  } catch {
    return url;
  }
}

export function pickProductImage(images: HtmlImage[], query: string): string | undefined {
  const q = query.toLowerCase();
  const ranked = images
    .map((image) => {
      const hay = `${image.alt} ${image.url}`.toLowerCase();
      let score = Math.min(image.width || 0, 640) / 40;
      if (
        /instagram|facebook|logo|favicon|sprite|icon|pixel|banner|promo|advert|adservice|doubleclick|sponsor|whatsapp|share|badge|cropped-|header|slider/.test(
          hay,
        )
      ) {
        score -= 80;
      }
      if (/_wm\b|watermark|浮水印/.test(hay)) score -= 90;
      if (isRetailerUrl(image.url) || RETAILER_COPY_RE.test(hay)) score -= 120;
      if (image.width > 0 && image.width < 160) score -= 25;
      if (/\.svg($|\?)/i.test(image.url)) score -= 20;
      if (/\.jpe?g($|\?)/i.test(image.url) || /\.jpe?g["']/i.test(image.alt)) score += 8;
      if (/mousse|pack|can|pouch|bag|配方|貓糧|狗糧|主食|wet|湯/.test(hay)) score += 16;
      if (/mackerel|鯖魚|ziwi|astkatta|royal/.test(hay)) score += 12;
      if (/mackerel\.png|ingredient|clipart/.test(hay) && image.width < 500) score -= 20;
      score += queryOverlapScore(hay, query);
      if (/清湯/.test(q) && /濃湯|pottage/.test(hay) && !/清湯/.test(hay)) score -= 32;
      if (/雞肉/.test(q) && /吞拿|tuna/.test(hay) && !/雞肉|chicken/.test(hay)) score -= 32;
      return { ...image, score };
    })
    .filter((image) => image.score > 0)
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  return best ? normalizeCdnImageUrl(best.url) : undefined;
}

export function isLikelyAdOrLogoImage(url: string, alt = ""): boolean {
  const hay = `${alt} ${url}`.toLowerCase();
  return /logo|favicon|banner|sprite|\bicon\b|advert|doubleclick|cropped-|header|slider|badge|adservice|_wm\b|watermark|浮水印/.test(
    hay,
  );
}

export function extractIngredientImageUrls(html: string): string[] {
  const section = html.match(
    /(?:main\s+ingredients|主要成[份分])[\s\S]{0,5000}?(?:analytical constituents|營養分析|保證分析)/i,
  );
  if (!section) return [];
  return extractHtmlImages(section[0]).map((image) => image.url);
}

export function isClipartIngredientLabel(text: string): boolean {
  const value = text.replace(/\s+/g, " ").trim();
  if (!value) return true;
  if (/\bicon\b|clipart|illustration|sprite|favicon/i.test(value)) return true;
  return false;
}

export function looksLikeIngredientList(text: string): boolean {
  const value = text.replace(/\s+/g, " ").trim();
  if (value.length < 8 || value.length > 800) return false;
  if (isClipartIngredientLabel(value)) return false;
  if (/[，,]/.test(value) && /(魚|肉|雞|牛|羊|tuna|chicken|salmon|mackerel)/i.test(value)) return true;
  if (/\d+(\.\d+)?\s*%/.test(value) && /(魚|肉|雞|牛|羊|tuna|chicken|salmon|mackerel|soup|湯)/i.test(value)) {
    return true;
  }
  if (/(魚|肉|雞|牛|羊|tuna|chicken|mackerel|salmon|sardine)/i.test(value) && value.split(" ").length >= 2) {
    return true;
  }
  return false;
}

export function nutritionFromPage(text: string): NutritionFacts {
  const facts = extractNutrition(text);
  if (!/硫酸軟骨素|chondroitin/i.test(text)) facts.chondroitinMgPerKg = undefined;
  if (!/葡萄糖胺|glucosamine/i.test(text)) facts.glucosamineMgPerKg = undefined;
  return facts;
}

function parseLocaleNumber(raw: string) {
  const n = Number(raw.replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

export function htmlToPlainText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr|h6)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function isCatalogNoise(text: string): boolean {
  const value = text.trim();
  if (!value) return true;
  if ((value.match(/\|/g) ?? []).length >= 3) return true;
  if (/全部配方|系列全部|慕絲貓罐系列全部/.test(value)) return true;
  if ((value.match(/配方/g) ?? []).length >= 4) return true;
  if ((value.match(/\bseries\b/gi) ?? []).length >= 4) return true;
  if (/analytical constituents|top of page|bottom of page/i.test(value) && value.length > 180) {
    return true;
  }
  return false;
}

const INGREDIENT_STOP =
  "營養分析|保證分析|粗蛋白質|analytical constituents|guaranteed analysis|protein\\s*\\(min\\)|crude protein|卡路里|metabolizable energy|代謝能";

export function extractIngredients(text: string): string | undefined {
  const match =
    text.match(
      new RegExp(`(?:主要成[份分]|成[份分])\\s*[:：]\\s*([\\s\\S]{0,800}?)(?:${INGREDIENT_STOP}|$)`, "i"),
    ) ||
    text.match(
      new RegExp(
        `(?:main\\s+)?ingredients?\\s*[:：]\\s*([\\s\\S]{0,800}?)(?:${INGREDIENT_STOP}|$)`,
        "i",
      ),
    ) ||
    text.match(
      new RegExp(
        `(?:main\\s+)?ingredients?(?=\\s*(?:chicken|tuna|salmon|mackerel|beef|lamb|soybean|雞肉|吞拿|鯖魚))\\s*([\\s\\S]{0,800}?)(?:${INGREDIENT_STOP}|$)`,
        "i",
      ),
    ) ||
    text.match(
      /原料\s*[:：]?\s*((?:雞肉|雞|魚|肉|chicken)[\s\S]{0,500}?)(?:營養補充|營養分析|保證成分|保證分析|analytical constituents|$)/i,
    );
  const extras = text.match(
    /營養補充\s*[:：]?\s*([\s\S]{0,400}?)(?:保證成分|營養分析|保證分析|analytical constituents|$)/i,
  );
  const value = match?.[1]?.replace(/\s+/g, " ").trim().replace(/[。.;；]+$/, "");
  const extra = extras?.[1]?.replace(/\s+/g, " ").trim().replace(/[。.;；]+$/, "");
  if (
    !value ||
    isCatalogNoise(value) ||
    isClipartIngredientLabel(value) ||
    /^(analytical constituents|guaranteed analysis|粗蛋白質)/i.test(value)
  ) {
    return undefined;
  }
  if (extra && extra.length >= 4 && !isCatalogNoise(extra) && !/^(保證成分|粗蛋白質)/i.test(extra)) {
    return `${value}，${extra}`;
  }
  return value;
}

export function pickIngredients(candidates: Array<string | undefined | null>): string | undefined {
  const cleaned = candidates
    .map((value) => value?.replace(/\s+/g, " ").trim())
    .filter((value): value is string => Boolean(value))
    .filter((value) => !isCatalogNoise(value) && !isClipartIngredientLabel(value));
  const ranked = cleaned
    .map((value) => ({
      value,
      score:
        ((value.match(/\d+(?:\.\d+)?\s*%/g) ?? []).length) * 6 +
        (value.match(/[，,、]/g) ?? []).length +
        (looksLikeIngredientList(value) ? 4 : 0) +
        Math.min(value.length, 400) / 100,
    }))
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.value;
}

export function refineIngredients(raw: string | undefined, query: string): string {
  const value = raw?.trim() ?? "";
  if (!value || isClipartIngredientLabel(value)) {
    if (/鯖魚/.test(query)) return "鯖魚";
    return "";
  }
  if (/^mackerel$/i.test(value) && /鯖魚/.test(query)) return "鯖魚（Mackerel）";
  return value;
}

export function extractIngredientAlts(html: string): string | undefined {
  const section = html.match(
    /(?:main\s+ingredients|主要成[份分])[\s\S]{0,4000}?(?:analytical constituents|營養分析|保證分析)/i,
  );
  if (!section) return undefined;
  const labels = [...section[0].matchAll(/alt=["']([^"']+)["']/gi)]
    .map((match) =>
      match[1]
        .replace(/\.(png|jpe?g|webp|gif|svg)$/i, "")
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(
      (label) =>
        label &&
        !/instagram|facebook|logo/i.test(label) &&
        !isClipartIngredientLabel(label),
    );
  if (labels.length === 0) return undefined;
  return [...new Set(labels)].join("、");
}

export function extractProductHighlights(text: string): string | undefined {
  const start = text.search(
    /all ages formula|產品特點|產品介紹|適合所有|kidney care|腎臟保健|低磷|high moisture|wet food|complete food for adult cats/i,
  );
  const end = text.search(
    /main ingredients|analytical constituents|主要成[份分]|營養分析|保證分析/i,
  );
  if (start < 0) return undefined;
  const slice = text.slice(start, end > start ? end : start + 700).trim();
  const lines = slice
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line && !/top of page|bottom of page|home|products/i.test(line));
  const value = lines.join("\n");
  if (value.length < 20 || isCatalogNoise(value)) return undefined;
  return value.slice(0, 600);
}

export function extractNutrition(text: string): NutritionFacts {
  const numberAfter = (labels: string[]) => {
    for (const label of labels) {
      const re = new RegExp(`${label}[^\\d%]{0,16}([\\d,.]+)\\s*%?`, "i");
      const match = text.match(re);
      if (match) return parseLocaleNumber(match[1]);
    }
    return undefined;
  };

  const mgPerKgAfter = (labels: string[]) => {
    for (const label of labels) {
      const re = new RegExp(`${label}[^\\d]{0,16}([\\d,]+)\\s*mg\\s*/\\s*kg`, "i");
      const match = text.match(re);
      if (match) return parseLocaleNumber(match[1]);
    }
    return undefined;
  };

  const proteinPct = numberAfter([
    "粗蛋白質",
    "crude protein",
    "protein\\s*\\(min\\)",
    "蛋白質",
    "\\bprotein\\b",
  ]);
  const fatPct = numberAfter(["粗脂肪", "crude fat", "fat\\s*\\(min\\)", "脂肪"]);
  const fiberPct = numberAfter([
    "粗纖維",
    "crude fiber",
    "crude fibre",
    "fiber\\s*\\(max\\)",
    "纖維",
  ]);
  const moisturePct = numberAfter(["水份", "水分", "moistures?", "moisture"]);
  const ashPct = numberAfter(["灰質", "ash\\s*\\(max\\)", "\\bash\\b"]);
  const taurinePct = numberAfter(["牛磺酸", "taurine"]);
  const chondroitinMgPerKg = mgPerKgAfter(["硫酸軟骨素", "chondroitin"]);
  const glucosamineMgPerKg = mgPerKgAfter(["葡萄糖胺", "glucosamine"]);

  const kcal100 =
    text.match(/([\d,.]+)\s*k?cal(?:ories)?\s*(?:\/|per|每)\s*100\s*g/i) ||
    text.match(/(?:kcal(?:\/|每)?\s*100\s*g|熱量(?:\/|每)?\s*100\s*g)[^\d]{0,12}([\d,.]+)/i) ||
    text.match(/calories?\s*[：:=]\s*([\d,.]+)/i) ||
    text.match(/代謝能[^\d]{0,28}([\d,.]+)/i) ||
    text.match(/metabolizable energy[^\d]{0,12}([\d,.]+)/i);
  const kcalKg =
    text.match(/(?:卡路里(?:含量)?|熱量|ME)\s*[=:]?\s*([\d,]+)\s*千卡\s*\/\s*公斤/i) ||
    text.match(/([\d,]+)\s*kcal\s*\/\s*kg/i);

  let kcalPer100g = kcal100 ? parseLocaleNumber(kcal100[1]) : undefined;
  if (kcalPer100g == null && kcalKg) {
    const perKg = parseLocaleNumber(kcalKg[1]);
    if (perKg) kcalPer100g = Math.round(perKg / 10);
  }

  return {
    proteinPct,
    fatPct,
    fiberPct,
    moisturePct,
    ashPct,
    taurinePct,
    kcalPer100g,
    chondroitinMgPerKg,
    glucosamineMgPerKg,
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
  return extractPackSizes(text)[0];
}

export function extractPackSizes(text: string): string[] {
  const sizes: string[] = [];
  for (const match of text.matchAll(/(\d+(?:\.\d+)?)\s*(kg|g)\b/gi)) {
    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    const before = text.slice(Math.max(0, (match.index ?? 0) - 12), match.index ?? 0);
    if (/\/|每|kcal|熱量/i.test(before) && amount === 100) continue;
    if (unit === "g" && (amount < 20 || amount > 20000)) continue;
    if (unit === "kg" && (amount <= 0 || amount > 30)) continue;
    const label = `${match[1]}${unit}`;
    if (!sizes.includes(label)) sizes.push(label);
  }
  return sizes.slice(0, 4);
}

export function gramsFromLabel(text: string): number | undefined {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(kg|g)\b/i);
  if (!match) return undefined;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return undefined;
  return match[2].toLowerCase() === "kg" ? Math.round(amount * 1000) : Math.round(amount);
}

export function queryOverlapScore(text: string, query: string): number {
  const hay = text.toLowerCase();
  let score = 0;
  for (const token of query.match(/[\u4e00-\u9fff]{2,}|[a-z]{4,}/gi) ?? []) {
    if (hay.includes(token.toLowerCase())) score += token.length >= 3 ? 4 : 3;
  }
  if (/清湯|雞肉絲|meat\s*(?:and|&)\s*soup/i.test(query)) {
    if (/清湯|雞肉絲|meat\s*(?:and|&)\s*soup|shredded/i.test(hay)) score += 20;
    if (/(濃湯|pottage)/i.test(hay) && !/清湯|雞肉絲/.test(hay)) score -= 28;
  }
  if (/濃湯|pottage/i.test(query) && /濃湯|pottage/i.test(hay)) score += 20;
  return score;
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

const CAT_PRODUCT_CUES =
  /主食包|主食慕絲|主食罐|慕絲罐|湯包|清湯|腎臟護理|腎貓|kidney care|貓咪|貓糧|for cats?\b/i;
const DOG_PRODUCT_CUES = /狗糧|犬用|for dogs?\b|狗主食|犬主食|dog food/i;
const KIDNEY_CARE_CUES = /腎貓|腎臟護理|腎臟保健|腎臟主食|kidney care/i;
const WET_FOOD_CUES =
  /濕糧|慕絲|肉泥|罐頭|主食罐|主食包|副食罐|湯包|清湯|保健湯包|濃湯|mousse|p[aâ]t[eé]|wet|canned|pouch|soup|pottage|kidney care/i;

export function inferProductSpecies(query: string, pageText = ""): string[] {
  const fromQuery = inferSpecies(query);
  if (fromQuery.length === 1) return fromQuery;

  const queryWantsDog = DOG_PRODUCT_CUES.test(query);
  const queryWantsCat = CAT_PRODUCT_CUES.test(query);
  if (queryWantsCat && !queryWantsDog) return ["CAT"];
  if (queryWantsDog && !queryWantsCat) return ["DOG"];
  if (fromQuery.length > 1) return fromQuery;

  const fromPage = inferSpecies(pageText);
  if (fromPage.length === 1) return fromPage;
  if (fromPage.includes("CAT") && !queryWantsDog) return ["CAT"];
  if (fromPage.includes("DOG") && !queryWantsCat) return ["DOG"];
  return fromPage;
}

export function inferProductLifeStages(query: string, pageText = ""): string[] {
  const found = inferLifeStages(`${query}\n${pageText}`);
  if (found.length > 0) return found;
  const species = inferProductSpecies(query, pageText);
  if (KIDNEY_CARE_CUES.test(`${query}\n${pageText}`) && species.includes("CAT") && !species.includes("DOG")) {
    return ["ADULT_CAT", "SENIOR_CAT"];
  }
  return [];
}

export function inferProductBlurb(query: string, pageText = ""): string | undefined {
  const hay = `${query}\n${pageText}`;
  const species = inferProductSpecies(query, pageText);
  const isCat = species.includes("CAT") && !species.includes("DOG");
  const isKidney = KIDNEY_CARE_CUES.test(hay);
  const isWet = WET_FOOD_CUES.test(hay);
  if (isCat && isKidney && isWet) {
    return "專為腎臟保健及腎貓研發的貓用濕糧。低磷、高水分，有助維持腎臟健康。";
  }
  if (isCat && isKidney) {
    return "專為腎臟保健及腎貓研發。";
  }
  if (isCat && isWet) {
    return "貓用濕糧。";
  }
  return undefined;
}

export function inferLifeStages(text: string): string[] {
  const value = text.toLowerCase();
  const species = inferSpecies(value);
  const catOnly = species.includes("CAT") && !species.includes("DOG");
  const dogOnly = species.includes("DOG") && !species.includes("CAT");
  const found: string[] = [];
  if (/幼犬|puppy/.test(value)) found.push("PUPPY");
  if (/幼貓|kitten/.test(value)) found.push("KITTEN");
  if (/成犬/.test(value) || (/adult/.test(value) && dogOnly)) found.push("ADULT_DOG");
  if (/成貓/.test(value) || (/adult/.test(value) && catOnly)) found.push("ADULT_CAT");
  if (/adult/.test(value) && !catOnly && !dogOnly && !found.includes("ADULT_DOG") && !found.includes("ADULT_CAT")) {
    if (species.includes("DOG")) found.push("ADULT_DOG");
    if (species.includes("CAT")) found.push("ADULT_CAT");
  }
  if (/老犬|老年犬/.test(value) || (/senior|ageing|aging|老年/.test(value) && dogOnly)) {
    found.push("SENIOR_DOG");
  }
  if (/老貓|老年貓/.test(value) || (/senior|ageing|aging|老年/.test(value) && catOnly)) {
    found.push("SENIOR_CAT");
  }
  if (/senior|ageing|aging|老年/.test(value) && !catOnly && !dogOnly) {
    if (species.includes("DOG") && !found.includes("SENIOR_DOG")) found.push("SENIOR_DOG");
    if (species.includes("CAT") && !found.includes("SENIOR_CAT")) found.push("SENIOR_CAT");
  }
  if (/全齡|all.?life.?stages|all.?ages/.test(value)) {
    const stages = catOnly
      ? ["KITTEN", "ADULT_CAT", "SENIOR_CAT"]
      : dogOnly
        ? ["PUPPY", "ADULT_DOG", "SENIOR_DOG"]
        : ["PUPPY", "KITTEN", "ADULT_DOG", "ADULT_CAT", "SENIOR_DOG", "SENIOR_CAT"];
    for (const stage of stages) {
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
  query: string,
  extraText: string,
  categories: { id: string; name: string; slug?: string }[],
): string | undefined {
  const q = query.toLowerCase();
  const extra = extraText.toLowerCase();
  const queryWantsCat = /貓|feline|cat\s*food|\bcats?\b|主食包|主食慕絲|慕絲罐|kidney care|腎臟|腎貓/.test(
    q,
  );
  const queryWantsDog = /狗|犬|canine|dog\s*food|\bdogs?\b/.test(q);
  const queryWantsWet = WET_FOOD_CUES.test(q);
  const queryWantsDry = /乾糧|風乾|kibble|air[\s-]?dried|\bdry\b/.test(q);

  const scored = categories
    .map((category) => {
      const name = category.name.toLowerCase();
      const slug = (category.slug ?? "").toLowerCase();
      const hay = `${name} ${slug}`;
      const isCat = /貓|cat/.test(hay);
      const isDog = /狗|犬|dog/.test(hay);
      const isWet = /濕|wet|mousse|罐/.test(hay);
      const isDry = /乾|dry|kibble|air/.test(hay);
      let score = 0;
      if (q.includes(name) && name.length >= 2) score += 30;
      if (slug && q.includes(slug.replace(/-/g, " "))) score += 8;
      if (isCat && queryWantsCat) score += 20;
      if (isDog && queryWantsDog) score += 20;
      if (isCat && queryWantsCat && !queryWantsDog) score += 12;
      if (isDog && queryWantsDog && !queryWantsCat) score += 12;
      if (isCat && queryWantsDog && !queryWantsCat) score -= 25;
      if (isDog && queryWantsCat && !queryWantsDog) score -= 25;
      if (isWet && queryWantsWet) score += 18;
      if (isDry && queryWantsDry) score += 18;
      if (isWet && queryWantsDry && !queryWantsWet) score -= 25;
      if (isDry && queryWantsWet && !queryWantsDry) score -= 25;
      if (extra.includes(name) && name.length >= 2) score += 2;
      return { id: category.id, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.id;
}

export const KNOWN_BRANDS = [
  "Astkatta",
  "Ziwi Peak",
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

export function extractUrlsFromQuery(query: string): string[] {
  return [...query.matchAll(/https?:\/\/[^\s<>"']+/gi)].map((match) =>
    match[0].replace(/[),.;]+$/g, ""),
  );
}

export function extractSitemapLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map((match) =>
    decodeURIComponent(match[1].trim()),
  );
}

const URL_QUERY_HINTS: Array<{ test: RegExp; tokens: string[]; weight?: number }> = [
  { test: /貓糧|貓用|幼貓|成貓|feline|cat\s*food|\bcats?\b/i, tokens: ["catfood", "cat-food"] },
  { test: /狗糧|犬用|幼犬|成犬|canine|dog\s*food|\bdogs?\b/i, tokens: ["dogfood", "dog-food"] },
  { test: /風乾|air[\s-]?dried/i, tokens: ["airdried", "air-dried"] },
  { test: /慕絲|mousse|肉泥|p[aâ]t[eé]/i, tokens: ["mousse", "pate"] },
  { test: /濕糧|罐頭|主食罐|主食包|副食罐|湯包|清湯|wet|canned|pouch|soup/i, tokens: ["canned", "wet", "pouch", "soup"] },
  { test: /腎臟|kidney/i, tokens: ["kidney"] },
  { test: /鯖魚|mackerel|saba/i, tokens: ["mackerel", "marckerel", "markerel", "saba"] },
  { test: /羊肉|lamb/i, tokens: ["lamb"] },
  { test: /雞肉|chicken/i, tokens: ["chicken"] },
  { test: /牛肉|beef/i, tokens: ["beef"] },
  { test: /鹿肉|venison/i, tokens: ["venison"] },
  { test: /草胃|tripe/i, tokens: ["tripe"] },
];

export function scoreProductUrl(url: string, query: string): number {
  let path = url.toLowerCase();
  try {
    path = decodeURIComponent(new URL(url).pathname).toLowerCase();
  } catch {
    /* keep raw */
  }

  let score = 0;
  for (const hint of URL_QUERY_HINTS) {
    if (!hint.test.test(query)) continue;
    if (hint.tokens.some((token) => path.includes(token))) {
      score += hint.weight ?? 8;
    }
  }
  for (const token of query.match(/[\u4e00-\u9fff]{2,}/g) ?? []) {
    if (path.includes(token)) score += 6;
  }
  if (/貓糧|貓用|幼貓|成貓|feline|cat\s*food|\bcats?\b/i.test(query) && /dogfood|dog-food/.test(path)) {
    score -= 24;
  }
  if (/狗糧|犬用|幼犬|成犬|canine|dog\s*food|\bdogs?\b/i.test(query) && /catfood|cat-food/.test(path)) {
    score -= 24;
  }
  if (path === "/" || path === "") score -= 8;
  if (/\/(products|shop|series|about|faq|contact|members)(\/|$)/i.test(path)) score -= 16;
  return score;
}

export function rankUrlsForQuery(urls: string[], query: string): string[] {
  return [...new Set(urls)]
    .map((url) => ({ url, score: scoreProductUrl(url, query) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.url);
}

export function isGenericBrandCopy(text: string, query: string): boolean {
  const mentionsBothSpecies = /貓糧/.test(text) && /狗糧/.test(text);
  const queryIsSpecific = /配方|鯖魚|羊肉|雞肉|牛肉|鹿肉|風乾/.test(query);
  return mentionsBothSpecies && queryIsSpecific;
}

export function slugFromProductUrl(url: string): string {
  try {
    const path = decodeURIComponent(new URL(url).pathname).replace(/\/+$/, "");
    const last = path.split("/").filter(Boolean).pop() ?? "";
    if (!last || last === "www") return "";
    return last
      .toLowerCase()
      .replace(/[^\w]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  } catch {
    return "";
  }
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
    if (/royalcanin|hillspet|purina|orijen|acana|ziwipets|astkatta/.test(host)) value += 8;
    value += scoreProductUrl(hit.url, query);
    value += queryOverlapScore(`${hit.title} ${hit.url} ${hit.snippet}`, query);
    if (isRetailerUrl(hit.url)) value -= 40;
    if (/amazon|facebook|youtube|instagram/.test(host)) value -= 8;
    if (hit.title.toLowerCase().includes(q.slice(0, 12))) value += 2;
    if (/\.pdf($|\?)/i.test(hit.url)) value -= 6;
    return value;
  };

  return [...hits]
    .filter((hit) => isOfficialOrPublicUrl(hit.url, query))
    .sort((a, b) => score(b) - score(a));
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
  moisturePct: string;
  ashPct: string;
  taurinePct: string;
  chondroitinMgPerKg: string;
  glucosamineMgPerKg: string;
  ingredients: string;
  suitableFor: string[];
  lifeStages: string[];
  allergenIds: string[];
  variantSku: string;
  variantName: string;
  packSizes: string[];
  priceDollars: string;
  sources: { title: string; url: string }[];
  notes: string[];
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
