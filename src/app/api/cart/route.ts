import { NextResponse } from "next/server";
import { z } from "zod";
import { findOwnedCart, getOrCreateCart } from "@/lib/cart";
import { prisma } from "@/lib/prisma";

const addSchema = z.object({
  variantId: z.string(),
  quantity: z.number().int().positive().default(1),
});

const patchSchema = z.object({
  itemId: z.string(),
  quantity: z.number().int().min(0),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "資料格式錯誤" }, { status: 400 });
  }

  const { cart, sessionId, isGuest } = await getOrCreateCart();

  await prisma.cartItem.upsert({
    where: {
      cartId_variantId: {
        cartId: cart.id,
        variantId: parsed.data.variantId,
      },
    },
    create: {
      cartId: cart.id,
      variantId: parsed.data.variantId,
      quantity: parsed.data.quantity,
    },
    update: {
      quantity: { increment: parsed.data.quantity },
    },
  });

  const response = NextResponse.json({ ok: true });
  if (isGuest && sessionId) {
    response.cookies.set("cart_session", sessionId, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return response;
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "資料格式錯誤" }, { status: 400 });
  }

  const cart = await findOwnedCart();
  if (!cart) {
    return NextResponse.json({ error: "購物車不存在" }, { status: 404 });
  }

  const item = await prisma.cartItem.findFirst({
    where: { id: parsed.data.itemId, cartId: cart.id },
  });
  if (!item) {
    return NextResponse.json({ error: "找不到購物車項目" }, { status: 404 });
  }

  if (parsed.data.quantity === 0) {
    await prisma.cartItem.delete({ where: { id: item.id } });
  } else {
    await prisma.cartItem.update({
      where: { id: item.id },
      data: { quantity: parsed.data.quantity },
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const itemId = url.searchParams.get("itemId");
  if (!itemId) {
    return NextResponse.json({ error: "缺少項目" }, { status: 400 });
  }

  const cart = await findOwnedCart();
  if (!cart) {
    return NextResponse.json({ error: "購物車不存在" }, { status: 404 });
  }

  await prisma.cartItem.deleteMany({
    where: { id: itemId, cartId: cart.id },
  });

  return NextResponse.json({ ok: true });
}
