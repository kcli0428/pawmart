import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  daysOfFoodRemaining,
  daysUntilBirthday,
  inferredLifeStage,
  isRunningLow,
} from "./crm";

describe("inferredLifeStage", () => {
  it("classifies dogs by age", () => {
    const now = new Date("2026-08-14");
    assert.equal(inferredLifeStage("DOG", new Date("2026-01-14"), now), "PUPPY");
    assert.equal(inferredLifeStage("DOG", new Date("2024-08-14"), now), "ADULT");
    assert.equal(inferredLifeStage("DOG", new Date("2017-08-14"), now), "SENIOR");
  });

  it("classifies cats by age", () => {
    const now = new Date("2026-08-14");
    assert.equal(inferredLifeStage("CAT", new Date("2026-02-01"), now), "KITTEN");
    assert.equal(inferredLifeStage("CAT", new Date("2015-08-14"), now), "SENIOR");
  });
});

describe("running low", () => {
  it("flags food that will run out within a week", () => {
    const remaining = daysOfFoodRemaining({
      orderedAt: new Date("2026-08-01"),
      quantity: 1,
      weightGrams: 2000,
      kcalPer100g: 360,
      dailyKcal: 550,
      now: new Date("2026-08-14"),
    });
    assert.equal(Math.round(remaining), 0);
    assert.equal(isRunningLow(remaining), true);
  });
});

describe("daysUntilBirthday", () => {
  it("returns 0 on the birthday", () => {
    const now = new Date("2026-08-14");
    assert.equal(daysUntilBirthday(new Date("2020-08-14"), now), 0);
  });
});
