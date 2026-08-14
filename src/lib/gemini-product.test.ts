import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractJsonObject, parseGeminiProductFill } from "./gemini-product";

describe("parseGeminiProductFill", () => {
  it("reads fenced JSON and drops retailer copy", () => {
    const raw = `\`\`\`json
{
  "brand": "Astkatta",
  "description": "專為腎貓研發的貓用濕糧。",
  "ingredients": "雞肉 39.5%、湯 54.62%、大豆油",
  "proteinPct": 10,
  "fatPct": 1.8,
  "moisturePct": 85,
  "kcalPer100g": 63.34,
  "suitableFor": ["CAT", "DRAGON"],
  "lifeStages": ["ADULT_CAT", "SENIOR_CAT"],
  "sources": [
    {"title": "Official", "url": "https://www.astkatta.com/kidney-care-series"},
    {"title": "Shop", "url": "https://www.gogopet.com.hk/x"},
    {"title": "OFF", "url": "https://world.openfoodfacts.org/product/123"}
  ]
}
\`\`\``;
    const parsed = parseGeminiProductFill(raw);
    assert.equal(parsed?.brand, "Astkatta");
    assert.match(parsed?.description ?? "", /腎貓/);
    assert.match(parsed?.ingredients ?? "", /雞肉 39\.5%/);
    assert.equal(parsed?.nutrition.proteinPct, 10);
    assert.deepEqual(parsed?.suitableFor, ["CAT"]);
    assert.deepEqual(parsed?.lifeStages, ["ADULT_CAT", "SENIOR_CAT"]);
    assert.equal(parsed?.sources.length, 1);
    assert.match(parsed?.sources[0]?.url ?? "", /astkatta\.com/);
  });

  it("rejects retailer shop names in description", () => {
    const parsed = parseGeminiProductFill(
      JSON.stringify({
        description: "GoGoPet 有售的腎臟主食包",
        ingredients: "雞肉",
      }),
    );
    assert.equal(parsed?.description, undefined);
  });

  it("returns null for empty text", () => {
    assert.equal(extractJsonObject("no json here"), null);
    assert.equal(parseGeminiProductFill("sorry"), null);
  });
});
