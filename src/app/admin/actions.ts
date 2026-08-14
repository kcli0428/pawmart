"use server";

import { revalidatePath } from "next/cache";
import { generateCampaigns, markCampaignSent } from "@/lib/campaigns";
import { fulfillSubscriptionOrder } from "@/lib/checkout";
import { receiveLot } from "@/lib/inventory";
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

  await receiveLot({
    variantId,
    lotNumber,
    expiryDate: new Date(expiry),
    quantity,
  });

  revalidatePath("/admin/inventory");
  revalidatePath("/admin");
  return { ok: `已入庫批號 ${lotNumber}` };
}

export async function generateCampaignsAction(): Promise<void> {
  await requireAdmin();
  await generateCampaigns();
  revalidatePath("/admin/crm");
}

export async function markCampaignSentAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await markCampaignSent(id);
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
