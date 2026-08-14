import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractDuckDuckGoResults,
  extractHkdPrice,
  extractIngredients,
  extractJsonLdProduct,
  extractNutrition,
  extractPackSizes,
  extractSitemapLocs,
  extractWeightLabel,
  htmlToPlainText,
  inferCategoryId,
  inferLifeStages,
  inferSpecies,
  isGenericBrandCopy,
  preferOfficialHits,
  rankUrlsForQuery,
  unwrapDuckDuckGoUrl,
} from "./product-lookup-parse";

describe("unwrapDuckDuckGoUrl", () => {
  it("decodes organic uddg destinations and drops ads", () => {
    const organic = unwrapDuckDuckGoUrl(
      "//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.royalcanin.com%2Fus%2Fcats",
    );
    assert.equal(organic, "https://www.royalcanin.com/us/cats");

    const ad = unwrapDuckDuckGoUrl(
      "//duckduckgo.com/l/?uddg=https%3A%2F%2Fduckduckgo.com%2Fy.js%3Fad_domain%3Damazon.com",
    );
    assert.equal(ad, null);
  });
});

describe("extractDuckDuckGoResults", () => {
  it("reads title, snippet, and destination URL", () => {
    const html = `
      <h2 class="result__title">
        <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fen.wikipedia.org%2Fwiki%2FRoyal_Canin">Royal Canin</a>
      </h2>
      <a class="result__snippet">French pet food manufacturer.</a>
    `;
    assert.deepEqual(extractDuckDuckGoResults(html), [
      {
        title: "Royal Canin",
        url: "https://en.wikipedia.org/wiki/Royal_Canin",
        snippet: "French pet food manufacturer.",
      },
    ]);
  });
});

describe("extractJsonLdProduct", () => {
  it("reads Product schema name, brand, and image", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@type": "Product",
      name: "Kitten Dry Cat Food",
      brand: { "@type": "Brand", name: "Royal Canin" },
      image: "https://example.com/kitten.jpg",
      description: "Complete kitten food.",
    })}</script>`;
    assert.deepEqual(extractJsonLdProduct(html), {
      name: "Kitten Dry Cat Food",
      brand: "Royal Canin",
      description: "Complete kitten food.",
      imageUrl: "https://example.com/kitten.jpg",
      priceHkdDollars: undefined,
    });
  });
});

describe("nutrition and inference", () => {
  it("extracts protein/fat/fiber and kcal", () => {
    const n = extractNutrition("蛋白質 32% 脂肪 16% 纖維 3.5% kcal/100g 390");
    assert.equal(n.proteinPct, 32);
    assert.equal(n.fatPct, 16);
    assert.equal(n.fiberPct, 3.5);
    assert.equal(n.kcalPer100g, 390);
  });

  it("parses guaranteed analysis from a Traditional Chinese official page", () => {
    const text =
      "主要成份：鯖魚，羊肉，羊肝 營養分析： 粗蛋白質(最少) 44% 粗脂肪 (最少) 24% 粗纖維 (最多) 3% 水份 (最多) 14% 灰質 (最多) 12% 牛磺酸(最少) 0.20% 硫酸軟骨素 (最少) 1,300mg/kg 葡萄糖胺 (最少) 1,000mg/kg 卡路里含量 ME=4,500千卡/公斤";
    const n = extractNutrition(text);
    assert.equal(n.proteinPct, 44);
    assert.equal(n.fatPct, 24);
    assert.equal(n.fiberPct, 3);
    assert.equal(n.moisturePct, 14);
    assert.equal(n.ashPct, 12);
    assert.equal(n.taurinePct, 0.2);
    assert.equal(n.chondroitinMgPerKg, 1300);
    assert.equal(n.glucosamineMgPerKg, 1000);
    assert.equal(n.kcalPer100g, 450);
    assert.match(extractIngredients(text) ?? "", /鯖魚，羊肉/);
  });

  it("prefers 貓糧 when the query is cat food even if extra copy mentions dogs", () => {
    const id = inferCategoryId(
      "Ziwi Peak 風乾貓糧 鯖魚及羊肉配方",
      "ZIWI PEAK 100% 紐西蘭製造 優質 風乾生肉 貓糧 狗糧 Air-Dried Dog and Cat Food",
      [
        { id: "dog", name: "狗糧", slug: "dog-food" },
        { id: "cat", name: "貓糧", slug: "cat-food" },
      ],
    );
    assert.equal(id, "cat");
  });

  it("infers cat kitten and HKD price", () => {
    assert.deepEqual(inferSpecies("Royal Canin 幼貓乾糧"), ["CAT"]);
    assert.deepEqual(inferLifeStages("Kitten dry food"), ["KITTEN"]);
    assert.equal(extractHkdPrice("售價 HK$288.00"), "288.00");
    assert.equal(extractWeightLabel("400g ｜ 1kg"), "400g");
    assert.deepEqual(extractPackSizes("400g ｜ 1kg"), ["400g", "1kg"]);
  });

  it("parses Wix-style official HTML into ingredients and analysis", () => {
    const html = `
      <h6>主要成份：</h6>
      <h3>鯖魚，羊肉，羊肝，新西蘭綠唇貽貝</h3>
      <h6>營養分析：</h6>
      <h3>粗蛋白質(最少) 44%<br>粗脂肪 (最少) 24%<br>粗纖維 (最多) 3%<br>
      水份 (最多) 14%<br>灰質 (最多) 12%<br>牛磺酸(最少) 0.20%<br>
      硫酸軟骨素 (最少) 1,300mg/kg<br>葡萄糖胺 (最少) 1,000mg/kg<br>
      卡路里含量 ME=4,500千卡/公斤</h3>
      <h6>400g ｜ 1kg</h6>`;
    const text = htmlToPlainText(html);
    const n = extractNutrition(text);
    assert.match(extractIngredients(text) ?? "", /鯖魚，羊肉/);
    assert.equal(n.proteinPct, 44);
    assert.equal(n.kcalPer100g, 450);
    assert.deepEqual(extractPackSizes(text), ["400g", "1kg"]);
  });

  it("ranks the cat mackerel-lamb air-dried URL above dog and other recipes", () => {
    const ranked = rankUrlsForQuery(
      [
        "https://www.ziwipetshk.com/dogfood-airdried-mackerellamb",
        "https://www.ziwipetshk.com/catfood-airdried-lamb",
        "https://www.ziwipetshk.com/catfood-airdried-marckerellamb",
        "https://www.ziwipetshk.com/catfood-canned-markerellamb",
      ],
      "Ziwi Peak 風乾貓糧 鯖魚及羊肉配方",
    );
    assert.equal(ranked[0], "https://www.ziwipetshk.com/catfood-airdried-marckerellamb");
  });

  it("reads sitemap loc URLs and treats dual species marketing copy as generic", () => {
    const xml = `<urlset><url><loc>https://www.ziwipetshk.com/catfood-airdried-marckerellamb</loc></url></urlset>`;
    assert.deepEqual(extractSitemapLocs(xml), [
      "https://www.ziwipetshk.com/catfood-airdried-marckerellamb",
    ]);
    assert.equal(
      isGenericBrandCopy(
        "ZIWI PEAK 100% 紐西蘭製造 優質 風乾生肉 貓糧 狗糧",
        "Ziwi Peak 風乾貓糧 鯖魚及羊肉配方",
      ),
      true,
    );
  });

  it("ranks official and wikipedia hits above marketplaces", () => {
    const ranked = preferOfficialHits(
      [
        { title: "Amazon", url: "https://www.amazon.com/x", snippet: "" },
        { title: "Wiki", url: "https://en.wikipedia.org/wiki/Royal_Canin", snippet: "" },
        { title: "Official", url: "https://www.royalcanin.com/kitten", snippet: "" },
      ],
      "Royal Canin kitten",
    );
    assert.equal(ranked[0].url.includes("royalcanin.com"), true);
  });
});
