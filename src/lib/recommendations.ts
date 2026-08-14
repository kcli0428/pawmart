import { PetLifeStage, PetSpecies } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type PetProfile = {
  species: PetSpecies;
  lifeStage?: PetLifeStage | null;
  weightKg?: number | null;
  allergies?: string[];
};

/**
 * MVP recommendation: filter by species, life stage, and exclude allergens.
 * Phase 3: add nutrition calculation (kcal/day) and scoring.
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
                  allergen: { name: { in: pet.allergies } },
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
    take: limit,
  });

  return products.filter((p) => p.variants.length > 0);
}

export function estimateDailyKcal(
  species: PetSpecies,
  weightKg: number,
  lifeStage?: PetLifeStage | null,
): number {
  const isYoung =
    lifeStage === PetLifeStage.PUPPY || lifeStage === PetLifeStage.KITTEN;
  const isSenior = lifeStage === PetLifeStage.SENIOR;

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
