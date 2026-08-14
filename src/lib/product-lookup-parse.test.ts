import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractDuckDuckGoResults,
  extractHkdPrice,
  extractIngredientAlts,
  extractIngredients,
  extractJsonLdProduct,
  extractNutrition,
  extractPackSizes,
  extractProductHighlights,
  extractSitemapLocs,
  extractWeightLabel,
  htmlToPlainText,
  inferCategoryId,
  inferLifeStages,
  inferProductBlurb,
  inferProductLifeStages,
  inferProductSpecies,
  inferSpecies,
  isCatalogNoise,
  isClipartIngredientLabel,
  isGenericBrandCopy,
  isOfficialOrPublicUrl,
  hasRetailerCopy,
  nutritionFromPage,
  pickIngredients,
  pickProductImage,
  queryOverlapScore,
  preferOfficialHits,
  rankUrlsForQuery,
  refineIngredients,
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

  it("prefers 貓乾糧 for air-dried cat food and 貓濕糧 for mousse cans", () => {
    const categories = [
      { id: "dog-dry", name: "狗乾糧", slug: "dog-dry-food" },
      { id: "dog-wet", name: "狗濕糧", slug: "dog-wet-food" },
      { id: "cat-dry", name: "貓乾糧", slug: "cat-dry-food" },
      { id: "cat-wet", name: "貓濕糧", slug: "cat-wet-food" },
    ];
    assert.equal(
      inferCategoryId(
        "Ziwi Peak 風乾貓糧 鯖魚及羊肉配方",
        "ZIWI PEAK 100% 紐西蘭製造 優質 風乾生肉 貓糧 狗糧 Air-Dried Dog and Cat Food",
        categories,
      ),
      "cat-dry",
    );
    assert.equal(
      inferCategoryId("Astkatta 冰島 鯖魚貓主食慕絲罐", "", categories),
      "cat-wet",
    );
    assert.equal(
      inferCategoryId(
        "Astkatta冰島Kidney Care腎臟主食包-雞肉絲清湯（50g）",
        "",
        categories,
      ),
      "cat-wet",
    );
  });

  it("infers cat kitten and HKD price", () => {
    assert.deepEqual(inferSpecies("Royal Canin 幼貓乾糧"), ["CAT"]);
    assert.deepEqual(inferLifeStages("Kitten dry food"), ["KITTEN"]);
    assert.deepEqual(inferLifeStages("成貓主食罐"), ["ADULT_CAT"]);
    assert.deepEqual(inferLifeStages("成犬糧"), ["ADULT_DOG"]);
    assert.deepEqual(inferLifeStages("全齡貓適用"), ["KITTEN", "ADULT_CAT", "SENIOR_CAT"]);
    assert.deepEqual(
      inferProductSpecies("Astkatta冰島 Kidney Care腎臟主食包-雞肉絲清湯50G"),
      ["CAT"],
    );
    assert.deepEqual(
      inferProductLifeStages("Astkatta冰島Kidney Care腎臟主食包-雞肉絲清湯（50g）"),
      ["ADULT_CAT", "SENIOR_CAT"],
    );
    assert.match(
      inferProductBlurb("Astkatta冰島Kidney Care腎臟主食包-雞肉絲清湯（50g）") ?? "",
      /腎貓研發的貓用濕糧/,
    );
    assert.equal(isClipartIngredientLabel("Chicken Icon"), true);
    assert.equal(
      extractIngredients("成分:\n雞肉39.5%，湯54.62%\n營養分析：\n粗蛋白質（最低）10%"),
      "雞肉39.5%，湯54.62%",
    );
    assert.match(
      extractIngredients(
        "IngredientsChicken 39.5%, Supplement with Soup 54.62%, Soybean Oil 2%, Taurine 0.046%. Analytical constituents Crude Protein (min) 10%",
      ) ?? "",
      /Chicken 39\.5%/,
    );
    assert.equal(
      extractIngredientAlts(
        'Main Ingredients:<img alt="Chicken Icon" /><img alt="Soup Icon" />Analytical constituents: Protein (min): 10',
      ),
      undefined,
    );
    assert.match(
      pickIngredients(["Chicken Icon", "雞肉39.5%，湯54.62%", "鯖魚"]) ?? "",
      /雞肉39\.5%/,
    );
    assert.equal(refineIngredients("Chicken Icon", "Astkatta 雞肉絲清湯"), "");
    assert.equal(extractNutrition("代謝能(kcal/100g) 63.34%").kcalPer100g, 63.34);
    assert.match(
      extractIngredients(
        "原料\n雞肉 39.5%、湯連營養保充品 54.62%\n營養補充\n大豆油、維他命及礦物質、牛磺酸\n保證成分\n粗蛋白質（最低）10%",
      ) ?? "",
      /雞肉 39\.5%/,
    );
    assert.match(
      extractIngredients(
        "原料\n雞肉 39.5%、湯連營養保充品 54.62%\n營養補充\n大豆油、維他命及礦物質、牛磺酸\n保證成分\n粗蛋白質（最低）10%",
      ) ?? "",
      /大豆油/,
    );
    assert.ok(
      queryOverlapScore(
        "Astkatta 冰島腎臟主食包 雞肉絲清湯 50g",
        "Astkatta冰島 Kidney Care腎臟主食包-雞肉絲清湯50G",
      ) >
        queryOverlapScore(
          "ASTKATTA Kidney Care Complete Food Chicken Pottage 走地雞濃湯",
          "Astkatta冰島 Kidney Care腎臟主食包-雞肉絲清湯50G",
        ),
    );
    assert.equal(extractHkdPrice("售價 HK$288.00"), "288.00");
    assert.equal(extractWeightLabel("400g ｜ 1kg"), "400g");
    assert.deepEqual(extractPackSizes("400g ｜ 1kg"), ["400g", "1kg"]);
  });

  it("parses Astkatta English guaranteed analysis and ignores series dump copy", () => {
    const text = `
      Mackerel Mousse 80g
      All Ages Formula:
      Suitable for all ages cats
      Smooth & Easy to digest
      Main Ingredients:
      Analytical constituents:
      Protein (min): 6.5
      Crude Fat (min): 1.5
      Crude Fiber (max): 1
      Ash (max): 2.5
      Moistures (max): 88.2
      Calories: 54.2 Kcal/100g
    `;
    const n = extractNutrition(text);
    assert.equal(n.proteinPct, 6.5);
    assert.equal(n.fatPct, 1.5);
    assert.equal(n.fiberPct, 1);
    assert.equal(n.ashPct, 2.5);
    assert.equal(n.moisturePct, 88.2);
    assert.equal(n.kcalPer100g, 54.2);
    assert.equal(extractIngredients(text), undefined);
    assert.match(extractProductHighlights(text) ?? "", /All Ages Formula/);
    assert.equal(
      isCatalogNoise(
        "慕絲貓罐系列全部配方吞拿魚 | 純鱷魚肉 | 火雞肉雞肉 | 鯖魚鱈魚吞拿魚 | 山羊奶雞肉",
      ),
      true,
    );
    const html =
      'Main Ingredients:<img alt="mackerel.png" />Analytical constituents: Protein (min): 6.5';
    assert.match(extractIngredientAlts(html) ?? "", /mackerel/i);
    assert.equal(refineIngredients("mackerel", "Astkatta 冰島 鯖魚貓主食慕絲罐"), "鯖魚（Mackerel）");
    const astkattaNutrition = nutritionFromPage(text);
    assert.equal(astkattaNutrition.chondroitinMgPerKg, undefined);
    assert.equal(astkattaNutrition.glucosamineMgPerKg, undefined);
    const picked = pickProductImage(
      [
        {
          url: "https://static.wixstatic.com/media/abc/mackerel.png/v1/fill/w_134,h_118/x.png",
          alt: "mackerel.png",
          width: 134,
        },
        {
          url: "https://static.wixstatic.com/media/abc/Mousse%20Mackerel.jpg/v1/fill/w_373,h_291/x.jpg",
          alt: "Mousse Mackerel.jpg",
          width: 373,
        },
        {
          url: "https://static.wixstatic.com/media/01c3aff52f2a4dffa526d7a9843d46ea.png",
          alt: "Instagram",
          width: 39,
        },
      ],
      "Astkatta 冰島 鯖魚貓主食慕絲罐",
    );
    assert.match(picked ?? "", /w_1200/);
    assert.match(picked ?? "", /abc/);
    const kidneyQuery = "Astkatta冰島Kidney Care腎臟主食包-雞肉絲清湯（50g）";
    const kidneyPicked = pickProductImage(
      [
        {
          url: "https://www.gogopet.com.hk/wp-content/uploads/2024/06/2000x-2_wm-300x300.jpg",
          alt: "Astkatta 冰島腎臟主食包 - Kidney Care Complete Food - 雞肉絲清湯 50g",
          width: 1000,
        },
        {
          url: "https://static.wixstatic.com/media/abc/kidney-chicken-soup.jpg",
          alt: "Chicken Meat & Soup Kidney Care 雞肉絲清湯",
          width: 400,
        },
      ],
      kidneyQuery,
    );
    assert.match(kidneyPicked ?? "", /kidney-chicken-soup/);
    assert.equal(isOfficialOrPublicUrl("https://www.gogopet.com.hk/product/x", kidneyQuery), false);
    assert.equal(
      isOfficialOrPublicUrl("https://world.openfoodfacts.org/product/123", kidneyQuery),
      false,
    );
    assert.equal(
      isOfficialOrPublicUrl("https://www.astkatta.com/kidney-care-series", kidneyQuery),
      true,
    );
    assert.equal(hasRetailerCopy("GoGoPet 天下貓貓 雞肉絲清湯"), true);
  });

  it("ranks mackerel mousse above other Astkatta recipes", () => {
    const ranked = rankUrlsForQuery(
      [
        "https://www.astkatta.com/crocodile-mousse-80g",
        "https://www.astkatta.com/pure-saba-80g",
        "https://www.astkatta.com/mackerel-mousse-80g",
        "https://www.astkatta.com/products",
      ],
      "Astkatta 冰島 鯖魚貓主食慕絲罐",
    );
    assert.equal(ranked[0], "https://www.astkatta.com/mackerel-mousse-80g");
  });

  it("ranks the Kidney Care series page for 腎臟主食包 queries", () => {
    const ranked = rankUrlsForQuery(
      [
        "https://www.astkatta.com/crocodile-mousse-80g",
        "https://www.astkatta.com/mackerel-mousse-80g",
        "https://www.astkatta.com/products",
        "https://www.astkatta.com/kidney-care-series",
      ],
      "Astkatta冰島 Kidney Care腎臟主食包-雞肉絲清湯50G",
    );
    assert.equal(ranked[0], "https://www.astkatta.com/kidney-care-series");
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
    assert.equal(
      ranked.some((hit) => hit.url.includes("amazon")),
      false,
    );
  });
});
