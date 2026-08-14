import type { CampaignType, Pet, PetLifeStage, PetSpecies } from "@/generated/prisma/client";
import {
  daysOfFoodRemaining,
  daysUntilBirthday,
  inferredLifeStage,
  isRunningLow,
} from "@/lib/crm";
import { LIFE_STAGE_LABELS } from "@/lib/constants";
import { campaignEmailHtml, sendEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { estimateDailyKcal } from "@/lib/recommendations";

const REORDER_THRESHOLD_DAYS = 7;
const BIRTHDAY_WINDOW_DAYS = 14;

export type RunningLowAlert = {
  pet: Pet;
  daysRemaining: number;
  productName: string;
  source: "order" | "subscription";
};

export async function getRunningLowAlerts(): Promise<RunningLowAlert[]> {
  const pets = await prisma.pet.findMany({
    include: {
      user: true,
      subscriptions: {
        where: { status: "ACTIVE" },
        include: { variant: { include: { product: true } } },
      },
    },
  });

  const alerts: RunningLowAlert[] = [];

  for (const pet of pets) {
    const dailyKcal =
      pet.weightKg != null
        ? estimateDailyKcal(pet.species, pet.weightKg, pet.lifeStage)
        : null;

    for (const sub of pet.subscriptions) {
      const days = (sub.nextDeliveryAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
      if (days <= REORDER_THRESHOLD_DAYS) {
        alerts.push({
          pet,
          daysRemaining: Math.round(days * 10) / 10,
          productName: sub.variant.product.name,
          source: "subscription",
        });
      }
    }

    if (!dailyKcal) continue;

    const lastItem = await prisma.orderItem.findFirst({
      where: {
        order: { userId: pet.userId, status: { in: ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] } },
        variant: {
          product: { suitableFor: { has: pet.species } },
          weightGrams: { not: null },
        },
      },
      include: {
        variant: { include: { product: true } },
        order: true,
      },
      orderBy: { order: { createdAt: "desc" } },
    });

    if (!lastItem?.variant.weightGrams || !lastItem.variant.product.kcalPer100g) continue;

    const remaining = daysOfFoodRemaining({
      orderedAt: lastItem.order.createdAt,
      quantity: lastItem.quantity,
      weightGrams: lastItem.variant.weightGrams,
      kcalPer100g: lastItem.variant.product.kcalPer100g,
      dailyKcal,
    });

    if (isRunningLow(remaining, REORDER_THRESHOLD_DAYS)) {
      alerts.push({
        pet,
        daysRemaining: Math.round(remaining * 10) / 10,
        productName: lastItem.variant.product.name,
        source: "order",
      });
    }
  }

  return alerts;
}

export async function getUpcomingBirthdays(withinDays = BIRTHDAY_WINDOW_DAYS) {
  const pets = await prisma.pet.findMany({
    where: { birthDate: { not: null } },
    include: { user: true },
  });

  return pets
    .filter((pet) => pet.birthDate && daysUntilBirthday(pet.birthDate) <= withinDays)
    .map((pet) => ({
      pet,
      daysUntil: daysUntilBirthday(pet.birthDate!),
    }))
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

export async function getLifeStageSuggestions() {
  const pets = await prisma.pet.findMany({
    where: { birthDate: { not: null } },
    include: { user: true },
  });

  return pets.flatMap((pet) => {
    if (!pet.birthDate) return [];
    const suggested = inferredLifeStage(pet.species as PetSpecies, pet.birthDate);
    if (pet.lifeStage === suggested) return [];
    return [
      {
        pet,
        current: pet.lifeStage as PetLifeStage | null,
        suggested,
      },
    ];
  });
}

async function hasRecentCampaign(userId: string, petId: string | null, type: CampaignType) {
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const existing = await prisma.campaign.findFirst({
    where: {
      userId,
      petId,
      type,
      createdAt: { gte: since },
    },
  });
  return Boolean(existing);
}

export async function generateCampaigns() {
  let created = 0;

  const runningLow = await getRunningLowAlerts();
  for (const alert of runningLow) {
    if (await hasRecentCampaign(alert.pet.userId, alert.pet.id, "REORDER")) continue;
    await prisma.campaign.create({
      data: {
        userId: alert.pet.userId,
        petId: alert.pet.id,
        type: "REORDER",
        title: `${alert.pet.name} 快吃完了`,
        body: `${alert.pet.name} 的「${alert.productName}」估計還剩約 ${alert.daysRemaining} 天。現在補貨可避免斷糧。`,
      },
    });
    created += 1;
  }

  const birthdays = await getUpcomingBirthdays();
  for (const item of birthdays) {
    if (await hasRecentCampaign(item.pet.userId, item.pet.id, "BIRTHDAY")) continue;
    const when = item.daysUntil === 0 ? "今天" : `${item.daysUntil} 天後`;
    await prisma.campaign.create({
      data: {
        userId: item.pet.userId,
        petId: item.pet.id,
        type: "BIRTHDAY",
        title: `${item.pet.name} 生日即將到來`,
        body: `${item.pet.name} 的生日是${when}。送上專屬優惠或零食禮包吧！`,
      },
    });
    created += 1;
  }

  const stages = await getLifeStageSuggestions();
  for (const item of stages) {
    if (await hasRecentCampaign(item.pet.userId, item.pet.id, "LIFE_STAGE")) continue;
    await prisma.campaign.create({
      data: {
        userId: item.pet.userId,
        petId: item.pet.id,
        type: "LIFE_STAGE",
        title: `${item.pet.name} 已進入${LIFE_STAGE_LABELS[item.suggested]}階段`,
        body: `建議將檔案從「${item.current ? LIFE_STAGE_LABELS[item.current] : "未設定"}」更新為「${LIFE_STAGE_LABELS[item.suggested]}」，並改看對應營養配方。`,
      },
    });
    created += 1;
  }

  return created;
}

export async function markCampaignSent(id: string) {
  return prisma.campaign.update({
    where: { id },
    data: { status: "SENT", sentAt: new Date() },
  });
}

export async function sendCampaign(id: string) {
  const campaign = await prisma.campaign.findUniqueOrThrow({
    where: { id },
    include: { user: true },
  });

  if (campaign.status === "SENT") {
    return { simulated: false, alreadySent: true };
  }

  const result = await sendEmail({
    to: campaign.user.email,
    subject: campaign.title,
    html: campaignEmailHtml(campaign.title, campaign.body),
  });

  await markCampaignSent(id);
  return { ...result, alreadySent: false };
}

export async function sendPendingCampaigns(limit = 50) {
  const pending = await prisma.campaign.findMany({
    where: { status: "PENDING" },
    include: { user: true },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let sent = 0;
  let simulated = 0;

  for (const campaign of pending) {
    const result = await sendEmail({
      to: campaign.user.email,
      subject: campaign.title,
      html: campaignEmailHtml(campaign.title, campaign.body),
    });
    await markCampaignSent(campaign.id);
    sent += 1;
    if (result.simulated) simulated += 1;
  }

  return { sent, simulated };
}
