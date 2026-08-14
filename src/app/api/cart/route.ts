import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

const schema = z.object({
  variantId: z.string(),
  quantity: z.number().int().positive().default(1),
});

async function getOrCreateCart(userId?: string, sessionId?: string) {
  if (userId) {
    return prisma.cart.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  if (!sessionId) {
    sessionId = randomUUID();
  }

  const cart = await prisma.cart.upsert({
    where: { sessionId },
    create: { sessionId },
    update: {},
  });

  return { cart, sessionId };
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "資料格式錯誤" }, { status: 400 });
  }

  const session = await auth();
  const cookieStore = await cookies();
  let sessionId = cookieStore.get("cart_session")?.value;

  const result = await getOrCreateCart(session?.user?.id, sessionId);
  const cart = "cart" in result ? result.cart : result;
  if ("sessionId" in result && result.sessionId) {
    sessionId = result.sessionId;
  }

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
  if (!session?.user && sessionId) {
    response.cookies.set("cart_session", sessionId, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return response;
}
