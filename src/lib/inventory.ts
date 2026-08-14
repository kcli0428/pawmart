import { ProductUnitType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Deduct inventory for a variant, expanding bundles into component SKUs.
 * Phase 2: also deduct from specific lot numbers (FEFO).
 */
export async function deductInventory(
  variantId: string,
  quantity: number,
): Promise<void> {
  const variant = await prisma.productVariant.findUniqueOrThrow({
    where: { id: variantId },
    include: {
      bundleComponents: { include: { componentVariant: true } },
    },
  });

  if (variant.unitType === ProductUnitType.BUNDLE) {
    for (const item of variant.bundleComponents) {
      const units = quantity * item.quantity;
      await prisma.productVariant.update({
        where: { id: item.componentVariantId },
        data: { stockQuantity: { decrement: units } },
      });
    }
    return;
  }

  const units =
    variant.unitType === ProductUnitType.CASE
      ? quantity * variant.unitsPerCase
      : quantity;

  const baseVariant =
    variant.unitType === ProductUnitType.CASE
      ? await findSingleVariant(variant.productId)
      : variant;

  await prisma.productVariant.update({
    where: { id: baseVariant.id },
    data: { stockQuantity: { decrement: units } },
  });
}

async function findSingleVariant(productId: string) {
  const single = await prisma.productVariant.findFirst({
    where: { productId, unitType: ProductUnitType.SINGLE, isActive: true },
  });
  if (!single) {
    throw new Error(`No single-unit variant for product ${productId}`);
  }
  return single;
}

/**
 * Check lots expiring within N days — used for admin alerts (Phase 2).
 */
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
