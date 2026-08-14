"use server";

import { revalidatePath } from "next/cache";
import { signOut } from "@/lib/auth";
import { HK_DISTRICTS } from "@/lib/constants";
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

export type AddressActionState = { error?: string; ok?: string } | null;

function parseAddressForm(formData: FormData) {
  const recipient = String(formData.get("recipient") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const district = String(formData.get("district") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim() || null;
  const isDefault = formData.get("isDefault") === "on";
  return { recipient, phone, district, address, label, isDefault };
}

async function ensureSingleDefault(userId: string, addressId: string) {
  await prisma.address.updateMany({
    where: { userId, id: { not: addressId } },
    data: { isDefault: false },
  });
}

export async function saveAddressAction(
  _prev: AddressActionState,
  formData: FormData,
): Promise<AddressActionState> {
  const session = await requireUser();
  const id = String(formData.get("id") ?? "").trim();
  const parsed = parseAddressForm(formData);

  if (!parsed.recipient || !parsed.phone || !parsed.district || !parsed.address) {
    return { error: "請填寫收件人、電話、地區與地址" };
  }
  if (!HK_DISTRICTS.includes(parsed.district as (typeof HK_DISTRICTS)[number])) {
    return { error: "請選擇有效的香港地區" };
  }

  const existingCount = await prisma.address.count({
    where: { userId: session.user.id },
  });
  const isDefault = parsed.isDefault || existingCount === 0;

  if (id) {
    const updated = await prisma.address.updateMany({
      where: { id, userId: session.user.id },
      data: { ...parsed, isDefault },
    });
    if (updated.count === 0) return { error: "找不到地址" };
    if (isDefault) await ensureSingleDefault(session.user.id, id);
  } else {
    const created = await prisma.address.create({
      data: {
        userId: session.user.id,
        ...parsed,
        isDefault,
      },
    });
    if (isDefault) await ensureSingleDefault(session.user.id, created.id);
  }

  revalidatePath("/account/addresses");
  revalidatePath("/cart");
  return { ok: id ? "已更新地址" : "已新增地址" };
}

export async function deleteAddressAction(formData: FormData) {
  const session = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.address.deleteMany({ where: { id, userId: session.user.id } });
  revalidatePath("/account/addresses");
  revalidatePath("/cart");
}

export async function setDefaultAddressAction(formData: FormData) {
  const session = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const owned = await prisma.address.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!owned) return;
  await prisma.address.update({ where: { id }, data: { isDefault: true } });
  await ensureSingleDefault(session.user.id, id);
  revalidatePath("/account/addresses");
  revalidatePath("/cart");
}
