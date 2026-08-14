"use server";

import { revalidatePath } from "next/cache";
import { generateCampaigns, sendCampaign, sendPendingCampaigns } from "@/lib/campaigns";
import { fulfillSubscriptionOrder } from "@/lib/checkout";
import {
  adjustLotQuantity,
  receiveLot,
  sendExpiryAlerts,
  transferLot,
} from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export type AdminActionState = { error?: string; ok?: string } | null;

export async function receiveLotAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdmin();
  const variantId = String(formData.get("variantId") ?? "");
  const lotNumber = String(formData.get("lotNumber") ?? "").trim();
  const expiry = String(formData.get("expiryDate") ?? "");
  const quantity = Number(formData.get("quantity") ?? 0);

  if (!variantId || !lotNumber || !expiry || quantity <= 0) {
    return { error: "請填寫完整進貨資料" };
  }

  const result = await receiveLot({
    variantId,
    lotNumber,
    expiryDate: new Date(expiry),
    quantity,
  });

  revalidatePath("/admin/inventory");
  revalidatePath("/admin");
  if (result.unpackedSingles > 0) {
    return {
      ok: `已入庫批號 ${lotNumber}，並拆入 ${result.unpackedSingles} 件單件庫存`,
    };
  }
  return { ok: `已入庫批號 ${lotNumber}` };
}

export async function adjustLotQuantityAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdmin();
  const lotId = String(formData.get("lotId") ?? "");
  const quantity = Number(formData.get("quantity") ?? -1);
  if (!lotId || !Number.isInteger(quantity) || quantity < 0) {
    return { error: "請輸入有效盤點數量" };
  }

  try {
    await adjustLotQuantity(lotId, quantity);
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") {
      return { error: "盤點後規格庫存不可為負" };
    }
    throw error;
  }

  revalidatePath("/admin/inventory");
  revalidatePath("/admin");
  return { ok: "已更新批號數量" };
}

export async function transferLotAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdmin();
  const fromLotId = String(formData.get("fromLotId") ?? "");
  const toLotNumber = String(formData.get("toLotNumber") ?? "").trim();
  const expiry = String(formData.get("toExpiryDate") ?? "");
  const quantity = Number(formData.get("quantity") ?? 0);

  if (!fromLotId || !toLotNumber || !expiry || quantity <= 0) {
    return { error: "請填寫完整調撥資料" };
  }

  try {
    await transferLot({
      fromLotId,
      toLotNumber,
      toExpiryDate: new Date(expiry),
      quantity,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_LOT_STOCK") {
      return { error: "來源批號數量不足" };
    }
    if (error instanceof Error && error.message === "SAME_LOT") {
      return { error: "來源與目標批號不可相同" };
    }
    throw error;
  }

  revalidatePath("/admin/inventory");
  return { ok: `已調撥 ${quantity} 件至批號 ${toLotNumber}` };
}

export async function sendExpiryAlertsAction(): Promise<void> {
  await requireAdmin();
  await sendExpiryAlerts(30);
  revalidatePath("/admin/inventory");
}

export async function generateCampaignsAction(): Promise<void> {
  await requireAdmin();
  await generateCampaigns();
  revalidatePath("/admin/crm");
}

export async function sendCampaignAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await sendCampaign(id);
  revalidatePath("/admin/crm");
}

export async function sendPendingCampaignsAction(): Promise<void> {
  await requireAdmin();
  await sendPendingCampaigns();
  revalidatePath("/admin/crm");
}

export async function processDueSubscriptionsAction(): Promise<void> {
  await requireAdmin();
  const due = await prisma.subscription.findMany({
    where: {
      status: "ACTIVE",
      nextDeliveryAt: { lte: new Date() },
    },
  });

  for (const sub of due) {
    await fulfillSubscriptionOrder(sub.id);
  }
  revalidatePath("/admin/crm");
  revalidatePath("/admin");
}

const ORDER_STATUSES = ["PENDING", "PAID", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"] as const;

export async function updateOrderStatusAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !ORDER_STATUSES.includes(status as (typeof ORDER_STATUSES)[number])) {
    return;
  }

  await prisma.order.update({
    where: { id },
    data: { status: status as (typeof ORDER_STATUSES)[number] },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
}
