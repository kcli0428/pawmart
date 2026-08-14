import { redirect } from "next/navigation";
import { PetForm } from "@/components/pets/pet-form";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRecommendationsForPet, estimateDailyKcal } from "@/lib/recommendations";
import { PET_SPECIES_LABELS, LIFE_STAGE_LABELS } from "@/lib/constants";
import { ProductCard } from "@/components/products/product-card";

export default async function PetsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const pets = await prisma.pet.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">我的寵物</h1>
          <p className="mt-1 text-zinc-600">管理多隻毛孩檔案，獲取個人化商品推薦</p>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="rounded-2xl border border-amber-100 bg-white p-6 lg:col-span-1">
          <h2 className="font-semibold">新增寵物</h2>
          <PetForm />
        </div>

        <div className="space-y-6 lg:col-span-2">
          {pets.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-amber-200 bg-white p-8 text-center text-zinc-500">
              尚未建立寵物檔案。填寫左側表單開始吧！
            </p>
          ) : (
            await Promise.all(
              pets.map(async (pet) => {
                const recommendations = await getRecommendationsForPet(pet, 4);
                const dailyKcal =
                  pet.weightKg != null
                    ? estimateDailyKcal(pet.species, pet.weightKg, pet.lifeStage)
                    : null;

                return (
                  <div
                    key={pet.id}
                    className="rounded-2xl border border-amber-100 bg-white p-6"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-xl font-bold">{pet.name}</h3>
                        <p className="text-sm text-zinc-500">
                          {PET_SPECIES_LABELS[pet.species]}
                          {pet.breed && ` · ${pet.breed}`}
                          {pet.lifeStage && ` · ${LIFE_STAGE_LABELS[pet.lifeStage]}`}
                        </p>
                        {pet.weightKg && (
                          <p className="mt-1 text-sm">體重 {pet.weightKg} kg</p>
                        )}
                        {dailyKcal && (
                          <p className="mt-1 text-sm text-amber-700">
                            估算每日熱量需求：约 {dailyKcal} kcal
                          </p>
                        )}
                        {pet.allergies.length > 0 && (
                          <p className="mt-1 text-sm text-red-600">
                            過敏：{pet.allergies.join("、")}
                          </p>
                        )}
                      </div>
                      <span className="text-4xl">🐾</span>
                    </div>

                    {recommendations.length > 0 && (
                      <div className="mt-6">
                        <h4 className="text-sm font-semibold text-zinc-700">
                          為 {pet.name} 推薦
                        </h4>
                        <div className="mt-3 grid gap-4 sm:grid-cols-2">
                          {recommendations.map((product) => {
                            const variant = product.variants[0];
                            if (!variant) return null;
                            return (
                              <ProductCard
                                key={product.id}
                                slug={product.slug}
                                name={product.name}
                                brand={product.brand}
                                imageUrl={product.imageUrl}
                                priceHkd={variant.priceHkd}
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }),
            )
          )}
        </div>
      </div>
    </div>
  );
}
