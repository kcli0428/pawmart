import { OrderStatus } from "@/generated/prisma/client";
import { deductInventory } from "@/lib/inventory";
import { pointsFromCents, tierFromBalance } from "@/lib/points";
import { prisma } from "@/lib/prisma";

export async function placeOrder(userId: string) {
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
  const orderNumber = `PM-${Date.now()}`;

  const order = await prisma.order.create({
    data: {
      orderNumber,
      userId,
      status: OrderStatus.PENDING,
      subtotalHkd: subtotal,
      totalHkd: subtotal,
      shippingAddress: { source: "demo-checkout" },
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
    throw error;
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { status: OrderStatus.PAID },
  });

  await awardPurchasePoints(userId, subtotal, `訂單 ${orderNumber} 購物回饋`);

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

  return order;
}

async function awardPurchasePoints(userId: string, cents: number, reason: string) {
  const points = pointsFromCents(cents);
  if (points <= 0) return;

  const account = await prisma.pointsAccount.upsert({
    where: { userId },
    create: { userId, balance: 0, tier: "BRONZE" },
    update: {},
  });

  const balance = account.balance + points;
  await prisma.pointsAccount.update({
    where: { id: account.id },
    data: { balance, tier: tierFromBalance(balance) },
  });
  await prisma.pointsTransaction.create({
    data: { accountId: account.id, amount: points, reason },
  });
}
