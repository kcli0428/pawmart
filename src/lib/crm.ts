import type { PetLifeStage, PetSpecies } from "@/generated/prisma/client";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function ageInMonths(birthDate: Date, now = new Date()): number {
  const years = now.getFullYear() - birthDate.getFullYear();
  const months = now.getMonth() - birthDate.getMonth();
  const dayAdjust = now.getDate() < birthDate.getDate() ? -1 : 0;
  return years * 12 + months + dayAdjust;
}

export function inferredLifeStage(
  species: PetSpecies,
  birthDate: Date,
  now = new Date(),
): PetLifeStage {
  const months = ageInMonths(birthDate, now);

  if (species === "DOG") {
    if (months < 12) return "PUPPY";
    if (months >= 96) return "SENIOR";
    return "ADULT";
  }

  if (species === "CAT") {
    if (months < 12) return "KITTEN";
    if (months >= 120) return "SENIOR";
    return "ADULT";
  }

  if (months >= 84) return "SENIOR";
  return "ADULT";
}

export function daysUntilBirthday(birthDate: Date, now = new Date()): number {
  const next = new Date(now.getFullYear(), birthDate.getMonth(), birthDate.getDate());
  if (next < startOfDay(now)) {
    next.setFullYear(next.getFullYear() + 1);
  }
  return Math.round((startOfDay(next).getTime() - startOfDay(now).getTime()) / MS_PER_DAY);
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function daysOfFoodRemaining(input: {
  orderedAt: Date;
  quantity: number;
  weightGrams: number;
  kcalPer100g: number;
  dailyKcal: number;
  now?: Date;
}): number {
  const { orderedAt, quantity, weightGrams, kcalPer100g, dailyKcal } = input;
  const now = input.now ?? new Date();
  if (dailyKcal <= 0 || weightGrams <= 0 || kcalPer100g <= 0) return Number.POSITIVE_INFINITY;

  const totalKcal = (quantity * weightGrams * kcalPer100g) / 100;
  const daysSupply = totalKcal / dailyKcal;
  const daysElapsed = (now.getTime() - orderedAt.getTime()) / MS_PER_DAY;
  return daysSupply - daysElapsed;
}

export function isRunningLow(daysRemaining: number, thresholdDays = 7): boolean {
  return Number.isFinite(daysRemaining) && daysRemaining <= thresholdDays;
}
