export type LotStock = {
  id: string;
  quantity: number;
  expiryDate: Date;
};

export type LotAllocation = {
  lotId: string;
  quantity: number;
};

export function unitsForPurchase(
  unitType: "SINGLE" | "CASE" | "BUNDLE",
  quantity: number,
  unitsPerCase = 1,
): number {
  if (quantity <= 0) {
    throw new Error("Quantity must be positive");
  }
  if (unitType === "CASE") {
    return quantity * Math.max(1, unitsPerCase);
  }
  return quantity;
}

/**
 * Allocate stock from lots using FEFO (first-expiry, first-out).
 * Throws if tracked lots cannot cover the requested quantity.
 */
export function allocateLotsFefo(
  lots: LotStock[],
  needed: number,
): LotAllocation[] {
  if (needed <= 0) return [];

  const sorted = [...lots]
    .filter((lot) => lot.quantity > 0)
    .sort((a, b) => a.expiryDate.getTime() - b.expiryDate.getTime());

  const allocations: LotAllocation[] = [];
  let remaining = needed;

  for (const lot of sorted) {
    if (remaining <= 0) break;
    const take = Math.min(lot.quantity, remaining);
    allocations.push({ lotId: lot.id, quantity: take });
    remaining -= take;
  }

  if (remaining > 0) {
    throw new Error("INSUFFICIENT_LOT_STOCK");
  }

  return allocations;
}

export function totalLotQuantity(lots: LotStock[]): number {
  return lots.reduce((sum, lot) => sum + Math.max(0, lot.quantity), 0);
}

/** CASE inbound unpacks into this many SINGLE units. */
export function unpackedSinglesFromCases(
  caseQty: number,
  unitsPerCase: number,
): number {
  if (caseQty <= 0) {
    throw new Error("Quantity must be positive");
  }
  return caseQty * Math.max(1, unitsPerCase);
}

export function lotQuantityDelta(current: number, next: number): number {
  if (next < 0) {
    throw new Error("LOT_QUANTITY_NEGATIVE");
  }
  return next - current;
}

export function assertTransferQuantity(fromQty: number, quantity: number) {
  if (quantity <= 0) {
    throw new Error("Quantity must be positive");
  }
  if (fromQty < quantity) {
    throw new Error("INSUFFICIENT_LOT_STOCK");
  }
}
