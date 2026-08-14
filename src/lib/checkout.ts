import { OrderStatus } from "@/generated/prisma/client";
import { getDefaultAddress, snapshotAddress } from "@/lib/addresses";
import { attributeCampaignConversions } from "@/lib/campaigns";
import { deductInventory } from "@/lib/inventory";
import { clampRedeemPoints, centsFromPoints, pointsFromCents, tierFromBalance } from "@/lib/points";
import { prisma } from "@/lib/prisma";

export async function placeOrder(userId: string, input: { redeemPoints?: number } = {}) {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: {
      items: { include: { variant: { include: { product: true } } } },
    },
  });

  if (!cart || cart.items.length === 0) {
    throw new Error("EMPTY_CART");
  }

  for (const item of cart.items) {
    if (item.variant.stockQuantity < item.quantity) {
      throw new Error(`缺貨：${item.variant.product.name}（${item.variant.name}）`);
    }
  }

  const subtotal = cart.items.reduce(
    (sum, item) => sum + item.variant.priceHkd * item.quantity,
    0,
  );
  const account = await prisma.pointsAccount.upsert({
    where: { userId },
    create: { userId, balance: 0, tier: "BRONZE" },
    update: {},
  });
  const redeem = clampRedeemPoints(input.redeemPoints ?? 0, account.balance, subtotal);
  const discountHkd = centsFromPoints(redeem);
  const totalHkd = Math.max(0, subtotal - discountHkd);
  const orderNumber = `PM-${Date.now()}`;
  const shipping = snapshotAddress(await getDefaultAddress(userId));

  if (redeem > 0) {
    await applyPointsDelta(userId, -redeem, `訂單 ${orderNumber} 點數折抵`);
  }

  const order = await prisma.order.create({
    data: {
      orderNumber,
      userId,
      status: OrderStatus.PENDING,
      subtotalHkd: subtotal,
      discountHkd,
      pointsRedeemed: redeem,
      totalHkd,
      shippingAddress: shipping,
      items: {
        create: cart.items.map((item) => ({
          variantId: item.variantId,
          quantity: item.quantity,
          priceHkd: item.variant.priceHkd,
        })),
      },
    },
    include: { items: true },
  });

  try {
    for (const item of order.items) {
      await deductInventory(item.variantId, item.quantity, item.id);
    }
  } catch (error) {
    await prisma.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.CANCELLED },
    });
    if (redeem > 0) {
      await applyPointsDelta(userId, redeem, `訂單 ${orderNumber} 取消退回點數`);
    }
    throw error;
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { status: OrderStatus.PAID },
  });

  await awardPurchasePoints(userId, totalHkd, `訂單 ${orderNumber} 購物回饋`);
  await attributeCampaignConversions(userId, order.id);
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

  return order;
}

export async function fulfillSubscriptionOrder(subscriptionId: string) {
  const subscription = await prisma.subscription.findUniqueOrThrow({
    where: { id: subscriptionId },
    include: { variant: { include: { product: true } } },
  });

  if (subscription.status !== "ACTIVE") {
    throw new Error("SUBSCRIPTION_INACTIVE");
  }

  const price = subscription.variant.priceHkd * subscription.quantity;
  const orderNumber = `PM-SUB-${Date.now()}`;

  const order = await prisma.order.create({
    data: {
      orderNumber,
      userId: subscription.userId,
      status: OrderStatus.PENDING,
      subtotalHkd: price,
      totalHkd: price,
      shippingAddress: { source: "subscription", subscriptionId },
      items: {
        create: {
          variantId: subscription.variantId,
          quantity: subscription.quantity,
          priceHkd: subscription.variant.priceHkd,
        },
      },
    },
    include: { items: true },
  });

  try {
    await deductInventory(subscription.variantId, subscription.quantity, order.items[0].id);
  } catch (error) {
    await prisma.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.CANCELLED },
    });
    throw error;
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { status: OrderStatus.PAID },
  });

  const nextDeliveryAt = new Date(subscription.nextDeliveryAt);
  nextDeliveryAt.setDate(nextDeliveryAt.getDate() + subscription.intervalDays);

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { nextDeliveryAt },
  });

  await awardPurchasePoints(
    subscription.userId,
    price,
    `訂閱訂單 ${orderNumber} 購物回饋`,
  );
  await attributeCampaignConversions(subscription.userId, order.id);

  return order;
}

async function applyPointsDelta(userId: string, amount: number, reason: string) {
  if (amount === 0) return;

  const account = await prisma.pointsAccount.upsert({
    where: { userId },
    create: { userId, balance: 0, tier: "BRONZE" },
    update: {},
  });

  if (amount < 0 && account.balance < -amount) {
    throw new Error("POINTS_INSUFFICIENT");
  }

  const balance = account.balance + amount;
  await prisma.pointsAccount.update({
    where: { id: account.id },
    data: { balance, tier: tierFromBalance(balance) },
  });
  await prisma.pointsTransaction.create({
    data: { accountId: account.id, amount, reason },
  });
}

async function awardPurchasePoints(userId: string, cents: number, reason: string) {
  const points = pointsFromCents(cents);
  if (points <= 0) return;
  await applyPointsDelta(userId, points, reason);
}
