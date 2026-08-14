import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pointsFromCents, tierFromBalance, nextTier } from "./points";

describe("points", () => {
  it("awards one point per HKD", () => {
    assert.equal(pointsFromCents(19800), 198);
    assert.equal(pointsFromCents(99), 0);
  });

  it("maps balances onto pet point tiers", () => {
    assert.equal(tierFromBalance(0), "BRONZE");
    assert.equal(tierFromBalance(500), "SILVER");
    assert.equal(tierFromBalance(1999), "SILVER");
    assert.equal(tierFromBalance(2000), "GOLD");
    assert.equal(tierFromBalance(5000), "PLATINUM");
  });

  it("reports remaining points until the next tier", () => {
    assert.deepEqual(nextTier(100), { tier: "SILVER", remaining: 400 });
    assert.equal(nextTier(5000), null);
  });
});
