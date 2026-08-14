import { PetLifeStage, PetSpecies } from "@/generated/prisma/client";

export type PetProfile = {
  species: PetSpecies;
  lifeStage?: PetLifeStage | null;
  weightKg?: number | null;
  allergies?: string[];
};

export type ProductNutritionInput = {
  kcalPer100g?: number | null;
  proteinPct?: number | null;
  lifeStages?: PetLifeStage[] | null;
  packWeightGrams?: number | null;
};

export function estimateDailyKcal(
  species: PetSpecies,
  weightKg: number,
  lifeStage?: PetLifeStage | null,
): number {
  const isYoung =
    lifeStage === PetLifeStage.PUPPY || lifeStage === PetLifeStage.KITTEN;
  const isSenior =
    lifeStage === PetLifeStage.SENIOR_DOG || lifeStage === PetLifeStage.SENIOR_CAT;

  if (species === PetSpecies.DOG) {
    const rer = 70 * Math.pow(weightKg, 0.75);
    if (isYoung) return Math.round(rer * 2);
    if (isSenior) return Math.round(rer * 1.2);
    return Math.round(rer * 1.4);
  }

  if (species === PetSpecies.CAT) {
    const rer = 70 * Math.pow(weightKg, 0.75);
    if (isYoung) return Math.round(rer * 2.5);
    if (isSenior) return Math.round(rer * 1.1);
    return Math.round(rer * 1.2);
  }

  return Math.round(70 * Math.pow(weightKg, 0.75));
}

export function gramsNeededPerDay(dailyKcal: number, kcalPer100g: number): number {
  if (dailyKcal <= 0 || kcalPer100g <= 0) return 0;
  return (dailyKcal * 100) / kcalPer100g;
}

export function packDaysOfSupply(
  packWeightGrams: number,
  dailyKcal: number,
  kcalPer100g: number,
): number | null {
  const grams = gramsNeededPerDay(dailyKcal, kcalPer100g);
  if (grams <= 0 || packWeightGrams <= 0) return null;
  return packWeightGrams / grams;
}

export function scoreProductForPet(product: ProductNutritionInput, pet: PetProfile): number {
  let score = 10;
  if (pet.lifeStage && product.lifeStages?.includes(pet.lifeStage)) score += 25;
  if (product.proteinPct != null) score += 5;

  const dailyKcal =
    pet.weightKg != null ? estimateDailyKcal(pet.species, pet.weightKg, pet.lifeStage) : null;
  if (dailyKcal && product.kcalPer100g && product.kcalPer100g > 0) {
    score += 30;
    const grams = gramsNeededPerDay(dailyKcal, product.kcalPer100g);
    if (grams > 1000) score -= 20;
    const days = product.packWeightGrams
      ? packDaysOfSupply(product.packWeightGrams, dailyKcal, product.kcalPer100g)
      : null;
    if (days != null && days >= 7 && days <= 45) score += 20;
    else if (days != null && days >= 3 && days <= 60) score += 10;
  }

  return score;
}

export function nutritionCaption(product: ProductNutritionInput, pet: PetProfile): string | undefined {
  const dailyKcal =
    pet.weightKg != null ? estimateDailyKcal(pet.species, pet.weightKg, pet.lifeStage) : null;
  if (!dailyKcal || !product.kcalPer100g) return undefined;
  const days =
    product.packWeightGrams != null
      ? packDaysOfSupply(product.packWeightGrams, dailyKcal, product.kcalPer100g)
      : null;
  if (days != null && Number.isFinite(days) && days > 0) {
    const rounded = days < 1 ? Math.round(days * 10) / 10 : Math.round(days);
    return `熱量吻合 · 此規格約可吃 ${rounded} 天`;
  }
  const grams = Math.round(gramsNeededPerDay(dailyKcal, product.kcalPer100g));
  return `熱量吻合 · 每日約 ${grams} g`;
}
