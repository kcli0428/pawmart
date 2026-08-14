import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getOrCreateCart() {
  const session = await auth();
  const cookieStore = await cookies();
  let sessionId = cookieStore.get("cart_session")?.value;
  const userId = session?.user?.id;

  if (userId) {
    const cart = await prisma.cart.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
    return { cart, sessionId: undefined as string | undefined, isGuest: false };
  }

  if (!sessionId) {
    sessionId = randomUUID();
  }

  const cart = await prisma.cart.upsert({
    where: { sessionId },
    create: { sessionId },
    update: {},
  });

  return { cart, sessionId, isGuest: true };
}

export async function findOwnedCart() {
  const session = await auth();
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("cart_session")?.value;
  const userId = session?.user?.id;

  if (userId) {
    return prisma.cart.findUnique({ where: { userId } });
  }
  if (sessionId) {
    return prisma.cart.findUnique({ where: { sessionId } });
  }
  return null;
}
