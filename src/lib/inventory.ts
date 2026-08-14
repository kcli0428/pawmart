import { ProductUnitType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  allocateLotsFefo,
  totalLotQuantity,
  unitsForPurchase,
} from "@/lib/inventory-logic";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function findSingleVariant(tx: Tx, productId: string) {
  const single = await tx.productVariant.findFirst({
    where: { productId, unitType: ProductUnitType.SINGLE, isActive: true },
  });
  if (!single) {
    throw new Error(`No single-unit variant for product ${productId}`);
  }
  return single;
}

async function deductFromTrackedVariant(
  tx: Tx,
  variantId: string,
  units: number,
  orderItemId?: string,
) {
  const variant = await tx.productVariant.findUniqueOrThrow({
    where: { id: variantId },
  });
  if (variant.stockQuantity < units) {
    throw new Error("INSUFFICIENT_STOCK");
  }

  const lots = await tx.productLot.findMany({
    where: { variantId, quantity: { gt: 0 } },
  });

  if (lots.length > 0) {
    const tracked = totalLotQuantity(lots);
    if (tracked < units) {
      throw new Error("INSUFFICIENT_LOT_STOCK");
    }
    const allocations = allocateLotsFefo(lots, units);
    for (const allocation of allocations) {
      await tx.productLot.update({
        where: { id: allocation.lotId },
        data: { quantity: { decrement: allocation.quantity } },
      });
      if (orderItemId) {
        await tx.lotDeduction.create({
          data: {
            orderItemId,
            lotId: allocation.lotId,
            quantity: allocation.quantity,
          },
        });
      }
    }
  }

  await tx.productVariant.update({
    where: { id: variantId },
    data: { stockQuantity: { decrement: units } },
  });
}

/**
 * Deduct inventory for a purchased variant.
 * CASE expands into single units; BUNDLE expands into component SKUs.
 * Lot quantities are consumed FEFO (earliest expiry first).
 */
export async function deductInventory(
  variantId: string,
  quantity: number,
  orderItemId?: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const variant = await tx.productVariant.findUniqueOrThrow({
      where: { id: variantId },
      include: {
        bundleComponents: true,
      },
    });

    if (variant.stockQuantity < quantity) {
      throw new Error("INSUFFICIENT_STOCK");
    }

    if (variant.unitType === ProductUnitType.BUNDLE) {
      await tx.productVariant.update({
        where: { id: variant.id },
        data: { stockQuantity: { decrement: quantity } },
      });
      for (const item of variant.bundleComponents) {
        const units = quantity * item.quantity;
        await deductFromTrackedVariant(tx, item.componentVariantId, units, orderItemId);
      }
      return;
    }

    if (variant.unitType === ProductUnitType.CASE) {
      const units = unitsForPurchase("CASE", quantity, variant.unitsPerCase);
      const single = await findSingleVariant(tx, variant.productId);
      await tx.productVariant.update({
        where: { id: variant.id },
        data: { stockQuantity: { decrement: quantity } },
      });
      await deductFromTrackedVariant(tx, single.id, units, orderItemId);
      return;
    }

    await deductFromTrackedVariant(tx, variant.id, quantity, orderItemId);
  });
}

export async function receiveLot(input: {
  variantId: string;
  lotNumber: string;
  expiryDate: Date;
  quantity: number;
}) {
  if (input.quantity <= 0) {
    throw new Error("Quantity must be positive");
  }

  return prisma.$transaction(async (tx) => {
    const lot = await tx.productLot.upsert({
      where: {
        variantId_lotNumber: {
          variantId: input.variantId,
          lotNumber: input.lotNumber.trim(),
        },
      },
      create: {
        variantId: input.variantId,
        lotNumber: input.lotNumber.trim(),
        expiryDate: input.expiryDate,
        quantity: input.quantity,
      },
      update: {
        quantity: { increment: input.quantity },
        expiryDate: input.expiryDate,
      },
    });

    await tx.productVariant.update({
      where: { id: input.variantId },
      data: { stockQuantity: { increment: input.quantity } },
    });

    return lot;
  });
}

export async function getExpiringLots(withinDays = 30) {
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + withinDays);

  return prisma.productLot.findMany({
    where: {
      expiryDate: { lte: deadline },
      quantity: { gt: 0 },
    },
    include: {
      variant: { include: { product: true } },
    },
    orderBy: { expiryDate: "asc" },
  });
}
