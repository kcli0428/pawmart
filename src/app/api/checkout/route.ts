import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", process.env.NEXTAUTH_URL ?? "http://localhost:3000"));
  }

  const cart = await prisma.cart.findUnique({
    where: { userId: session.user.id },
    include: {
      items: { include: { variant: { include: { product: true } } } },
    },
  });

  if (!cart || cart.items.length === 0) {
    return NextResponse.json({ error: "購物車是空的" }, { status: 400 });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json(
      {
        error: "Stripe 尚未設定。請在 .env 加入 STRIPE_SECRET_KEY 與 STRIPE_PUBLISHABLE_KEY。",
        docs: "https://stripe.com/docs/payments/checkout",
      },
      { status: 503 },
    );
  }

  const subtotal = cart.items.reduce(
    (sum, item) => sum + item.variant.priceHkd * item.quantity,
    0,
  );

  const orderNumber = `PM-${Date.now()}`;
  await prisma.order.create({
    data: {
      orderNumber,
      userId: session.user.id,
      subtotalHkd: subtotal,
      totalHkd: subtotal,
      shippingAddress: { placeholder: true },
      items: {
        create: cart.items.map((item) => ({
          variantId: item.variantId,
          quantity: item.quantity,
          priceHkd: item.variant.priceHkd,
        })),
      },
    },
  });

  // Phase 1: Stripe Checkout Session integration placeholder
  return NextResponse.json({
    message: "訂單已建立（待 Stripe Checkout 整合）",
    orderNumber,
    totalHkd: subtotal,
  });
}
