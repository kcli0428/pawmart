import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  estimateDailyKcal,
  gramsNeededPerDay,
  nutritionCaption,
  packDaysOfSupply,
  scoreProductForPet,
} from "./nutrition-score";

describe("nutrition scoring", () => {
  it("estimates higher kcal for kittens than adult cats", () => {
    const adult = estimateDailyKcal("CAT", 4, "ADULT_CAT");
    const kitten = estimateDailyKcal("CAT", 4, "KITTEN");
    assert.ok(kitten > adult);
  });

  it("ranks a complete analysis above a product with no kcal", () => {
    const pet = { species: "CAT" as const, lifeStage: "ADULT_CAT" as const, weightKg: 4 };
    const withKcal = scoreProductForPet(
      {
        kcalPer100g: 390,
        proteinPct: 32,
        lifeStages: ["ADULT_CAT"],
        packWeightGrams: 1000,
      },
      pet,
    );
    const without = scoreProductForPet({ lifeStages: ["ADULT_CAT"] }, pet);
    assert.ok(withKcal > without);
  });

  it("gives a pack-duration bonus when one bag lasts a few weeks", () => {
    const daily = estimateDailyKcal("CAT", 4, "ADULT_CAT");
    const grams = gramsNeededPerDay(daily, 390);
    const days = packDaysOfSupply(2000, daily, 390);
    assert.ok(grams > 0);
    assert.ok(days != null && days >= 7 && days <= 45);
    const caption = nutritionCaption(
      { kcalPer100g: 390, packWeightGrams: 2000 },
      { species: "CAT", lifeStage: "ADULT_CAT", weightKg: 4 },
    );
    assert.match(caption ?? "", /約可吃/);
  });
});
