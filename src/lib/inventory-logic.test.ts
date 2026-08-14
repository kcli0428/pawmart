import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { allocateLotsFefo, unitsForPurchase } from "./inventory-logic";

describe("unitsForPurchase", () => {
  it("returns quantity for single and bundle units", () => {
    assert.equal(unitsForPurchase("SINGLE", 3), 3);
    assert.equal(unitsForPurchase("BUNDLE", 2), 2);
  });

  it("multiplies case quantity by units per case", () => {
    assert.equal(unitsForPurchase("CASE", 2, 12), 24);
  });
});

describe("allocateLotsFefo", () => {
  it("consumes the earliest expiry first", () => {
    const allocations = allocateLotsFefo(
      [
        { id: "late", quantity: 10, expiryDate: new Date("2026-12-01") },
        { id: "soon", quantity: 4, expiryDate: new Date("2026-09-01") },
      ],
      6,
    );
    assert.deepEqual(allocations, [
      { lotId: "soon", quantity: 4 },
      { lotId: "late", quantity: 2 },
    ]);
  });

  it("throws when lots cannot cover demand", () => {
    assert.throws(
      () =>
        allocateLotsFefo(
          [{ id: "a", quantity: 2, expiryDate: new Date("2026-09-01") }],
          5,
        ),
      /INSUFFICIENT_LOT_STOCK/,
    );
  });
});
