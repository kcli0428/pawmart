import { ProductUnitType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  allocateLotsFefo,
  assertTransferQuantity,
  lotQuantityDelta,
  totalLotQuantity,
  unitsForPurchase,
  unpackedSinglesFromCases,
} from "@/lib/inventory-logic";
import { sendEmail } from "@/lib/email";

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

async function upsertLot(
  tx: Tx,
  variantId: string,
  lotNumber: string,
  expiryDate: Date,
  quantity: number,
) {
  return tx.productLot.upsert({
    where: {
      variantId_lotNumber: {
        variantId,
        lotNumber,
      },
    },
    create: {
      variantId,
      lotNumber,
      expiryDate,
      quantity,
    },
    update: {
      quantity: { increment: quantity },
      expiryDate,
    },
  });
}

/**
 * Receive inbound stock. CASE lots also unpack into SINGLE lots
 * (same lot number / expiry, quantity × unitsPerCase).
 */
export async function receiveLot(input: {
  variantId: string;
  lotNumber: string;
  expiryDate: Date;
  quantity: number;
}) {
  if (input.quantity <= 0) {
    throw new Error("Quantity must be positive");
  }

  const lotNumber = input.lotNumber.trim();

  return prisma.$transaction(async (tx) => {
    const variant = await tx.productVariant.findUniqueOrThrow({
      where: { id: input.variantId },
    });

    const lot = await upsertLot(
      tx,
      variant.id,
      lotNumber,
      input.expiryDate,
      input.quantity,
    );

    await tx.productVariant.update({
      where: { id: variant.id },
      data: { stockQuantity: { increment: input.quantity } },
    });

    let unpackedSingles = 0;
    if (variant.unitType === ProductUnitType.CASE) {
      const single = await findSingleVariant(tx, variant.productId);
      unpackedSingles = unpackedSinglesFromCases(
        input.quantity,
        variant.unitsPerCase,
      );
      await upsertLot(tx, single.id, lotNumber, input.expiryDate, unpackedSingles);
      await tx.productVariant.update({
        where: { id: single.id },
        data: { stockQuantity: { increment: unpackedSingles } },
      });
    }

    return { lot, unpackedSingles };
  });
}

export async function adjustLotQuantity(lotId: string, newQuantity: number) {
  return prisma.$transaction(async (tx) => {
    const lot = await tx.productLot.findUniqueOrThrow({ where: { id: lotId } });
    const change = lotQuantityDelta(lot.quantity, newQuantity);
    if (change === 0) return lot;

    const updated = await tx.productLot.update({
      where: { id: lotId },
      data: { quantity: newQuantity },
    });

    await tx.productVariant.update({
      where: { id: lot.variantId },
      data: { stockQuantity: { increment: change } },
    });

    const variant = await tx.productVariant.findUniqueOrThrow({
      where: { id: lot.variantId },
    });
    if (variant.stockQuantity < 0) {
      throw new Error("INSUFFICIENT_STOCK");
    }

    return updated;
  });
}

export async function transferLot(input: {
  fromLotId: string;
  toLotNumber: string;
  toExpiryDate: Date;
  quantity: number;
}) {
  const toLotNumber = input.toLotNumber.trim();

  return prisma.$transaction(async (tx) => {
    const from = await tx.productLot.findUniqueOrThrow({
      where: { id: input.fromLotId },
    });
    assertTransferQuantity(from.quantity, input.quantity);

    if (from.lotNumber === toLotNumber) {
      throw new Error("SAME_LOT");
    }

    await tx.productLot.update({
      where: { id: from.id },
      data: { quantity: { decrement: input.quantity } },
    });

    await upsertLot(
      tx,
      from.variantId,
      toLotNumber,
      input.toExpiryDate,
      input.quantity,
    );
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

function expiryAlertHtml(
  lots: Awaited<ReturnType<typeof getExpiringLots>>,
  withinDays: number,
) {
  const rows = lots
    .map(
      (lot) =>
        `<tr>
          <td>${lot.variant.product.name} — ${lot.variant.name}</td>
          <td>${lot.lotNumber}</td>
          <td>${lot.expiryDate.toLocaleDateString("zh-HK")}</td>
          <td>${lot.quantity}</td>
        </tr>`,
    )
    .join("");

  return `
    <p>以下 ${lots.length} 個批號將於 ${withinDays} 天內到期：</p>
    <table border="1" cellpadding="6" cellspacing="0">
      <thead>
        <tr><th>商品</th><th>批號</th><th>到期日</th><th>數量</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

export async function sendExpiryAlerts(withinDays = 30) {
  const lots = await getExpiringLots(withinDays);
  if (lots.length === 0) {
    return { sent: false, count: 0, simulated: false };
  }

  const adminEmail =
    process.env.ADMIN_ALERT_EMAIL ||
    (
      await prisma.user.findFirst({
        where: { role: "ADMIN" },
        select: { email: true },
      })
    )?.email;

  if (!adminEmail) {
    return { sent: false, count: lots.length, simulated: false };
  }

  const result = await sendEmail({
    to: adminEmail,
    subject: `PawMart 到期預警：${lots.length} 筆批次`,
    html: expiryAlertHtml(lots, withinDays),
  });

  return { sent: true, count: lots.length, simulated: result.simulated };
}
