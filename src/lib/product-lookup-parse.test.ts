import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractDuckDuckGoResults,
  extractHkdPrice,
  extractJsonLdProduct,
  extractNutrition,
  extractWeightLabel,
  inferLifeStages,
  inferSpecies,
  preferOfficialHits,
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

  it("infers cat kitten and HKD price", () => {
    assert.deepEqual(inferSpecies("Royal Canin 幼貓乾糧"), ["CAT"]);
    assert.deepEqual(inferLifeStages("Kitten dry food"), ["KITTEN"]);
    assert.equal(extractHkdPrice("售價 HK$288.00"), "288.00");
    assert.equal(extractWeightLabel("2kg 裝"), "2kg");
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
