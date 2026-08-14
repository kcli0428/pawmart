import { prisma } from "@/lib/prisma";
import {
  nutritionCaption,
  scoreProductForPet,
  type PetProfile,
} from "@/lib/nutrition-score";

export type { PetProfile } from "@/lib/nutrition-score";
export {
  estimateDailyKcal,
  gramsNeededPerDay,
  nutritionCaption,
  packDaysOfSupply,
  scoreProductForPet,
} from "@/lib/nutrition-score";

/**
 * Filter by species, life stage, and allergens, then rank by kcal / pack duration fit.
 */
export async function getRecommendationsForPet(pet: PetProfile, limit = 8) {
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      suitableFor: { has: pet.species },
      ...(pet.lifeStage ? { lifeStages: { has: pet.lifeStage } } : {}),
      ...(pet.allergies?.length
        ? {
            NOT: {
              allergens: {
                some: {
                  allergen: {
                    OR: [
                      { name: { in: pet.allergies, mode: "insensitive" } },
                      { nameZh: { in: pet.allergies } },
                    ],
                  },
                },
              },
            },
          }
        : {}),
    },
    include: {
      variants: { where: { isActive: true }, orderBy: { priceHkd: "asc" } },
      allergens: { include: { allergen: true } },
      category: true,
    },
    take: Math.max(limit * 4, 16),
  });

  return products
    .filter((product) => product.variants.length > 0)
    .map((product) => {
      const packWeightGrams =
        product.variants.find((variant) => variant.weightGrams != null)?.weightGrams ?? null;
      const score = scoreProductForPet(
        {
          kcalPer100g: product.kcalPer100g,
          proteinPct: product.proteinPct,
          lifeStages: product.lifeStages,
          packWeightGrams,
        },
        pet,
      );
      const caption = nutritionCaption(
        {
          kcalPer100g: product.kcalPer100g,
          packWeightGrams,
        },
        pet,
      );
      return { ...product, score, caption };
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "zh-Hant"))
    .slice(0, limit);
}
