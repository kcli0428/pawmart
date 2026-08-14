"use server";

import { revalidatePath } from "next/cache";
import { signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}

export async function createSubscriptionAction(formData: FormData) {
  const session = await requireUser();
  const variantId = String(formData.get("variantId") ?? "");
  const petIdRaw = String(formData.get("petId") ?? "");
  const intervalDays = Number(formData.get("intervalDays") ?? 30);
  const quantity = Number(formData.get("quantity") ?? 1);

  if (!variantId) {
    throw new Error("缺少商品規格");
  }

  const nextDeliveryAt = new Date();
  nextDeliveryAt.setDate(nextDeliveryAt.getDate() + (intervalDays || 30));

  await prisma.subscription.create({
    data: {
      userId: session.user.id,
      variantId,
      petId: petIdRaw || null,
      intervalDays: intervalDays || 30,
      quantity: quantity > 0 ? quantity : 1,
      nextDeliveryAt,
    },
  });

  revalidatePath("/account/subscriptions");
  revalidatePath(`/products`);
}

export async function updateSubscriptionStatusAction(formData: FormData) {
  const session = await requireUser();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !["ACTIVE", "PAUSED", "CANCELLED"].includes(status)) {
    throw new Error("無效操作");
  }

  await prisma.subscription.updateMany({
    where: { id, userId: session.user.id },
    data: { status: status as "ACTIVE" | "PAUSED" | "CANCELLED" },
  });

  revalidatePath("/account/subscriptions");
}
