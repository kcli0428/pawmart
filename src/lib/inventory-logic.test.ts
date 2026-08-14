import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allocateLotsFefo,
  assertTransferQuantity,
  lotQuantityDelta,
  unitsForPurchase,
  unpackedSinglesFromCases,
} from "./inventory-logic";

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

describe("unpackedSinglesFromCases", () => {
  it("multiplies inbound cases by units per case", () => {
    assert.equal(unpackedSinglesFromCases(2, 12), 24);
    assert.equal(unpackedSinglesFromCases(1, 0), 1);
  });
});

describe("lotQuantityDelta", () => {
  it("returns the signed adjustment to apply to variant stock", () => {
    assert.equal(lotQuantityDelta(10, 8), -2);
    assert.equal(lotQuantityDelta(3, 3), 0);
  });

  it("rejects negative lot quantities", () => {
    assert.throws(() => lotQuantityDelta(4, -1), /LOT_QUANTITY_NEGATIVE/);
  });
});

describe("assertTransferQuantity", () => {
  it("allows transferring within available lot quantity", () => {
    assert.doesNotThrow(() => assertTransferQuantity(10, 4));
  });

  it("rejects overdraw and non-positive quantities", () => {
    assert.throws(() => assertTransferQuantity(2, 5), /INSUFFICIENT_LOT_STOCK/);
    assert.throws(() => assertTransferQuantity(2, 0), /Quantity must be positive/);
  });
});
