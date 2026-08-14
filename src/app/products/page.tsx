import { ProductCard } from "@/components/products/product-card";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  LIFE_STAGE_GROUPS,
  LIFE_STAGE_LABELS,
  PET_SPECIES_LABELS,
  sortCategories,
} from "@/lib/constants";
import type { PetLifeStage, PetSpecies, Prisma } from "@/generated/prisma/client";
import Link from "next/link";
import { scoreProductForPet, nutritionCaption } from "@/lib/recommendations";

type Props = {
  searchParams: Promise<{
    category?: string;
    q?: string;
    species?: string;
    lifeStage?: string;
    allergen?: string;
    petId?: string;
  }>;
};

export default async function ProductsPage({ searchParams }: Props) {
  const { category, q, species, lifeStage, allergen, petId } = await searchParams;
  const session = await auth();

  const [rawCategories, allergens, pets] = await Promise.all([
    prisma.category.findMany(),
    prisma.allergen.findMany({ orderBy: { nameZh: "asc" } }),
    session?.user
      ? prisma.pet.findMany({
          where: { userId: session.user.id },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
  ]);
  const categories = sortCategories(rawCategories);

  const selectedPet = petId ? pets.find((pet) => pet.id === petId) : undefined;
  const speciesFilter = (selectedPet?.species ?? species) as PetSpecies | undefined;
  const lifeStageFilter = (selectedPet?.lifeStage ?? lifeStage) as PetLifeStage | undefined;
  const allergyNames = selectedPet?.allergies?.length
    ? selectedPet.allergies
    : allergen
      ? [allergen]
      : [];

  const where: Prisma.ProductWhereInput = {
    isActive: true,
    ...(category ? { category: { slug: category } } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { brand: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(speciesFilter && Object.keys(PET_SPECIES_LABELS).includes(speciesFilter)
      ? { suitableFor: { has: speciesFilter } }
      : {}),
    ...(lifeStageFilter && Object.keys(LIFE_STAGE_LABELS).includes(lifeStageFilter)
      ? { lifeStages: { has: lifeStageFilter } }
      : {}),
    ...(allergyNames.length
      ? {
          NOT: {
            allergens: {
              some: {
                allergen: {
                  OR: [
                    { name: { in: allergyNames, mode: "insensitive" } },
                    { nameZh: { in: allergyNames } },
                  ],
                },
              },
            },
          },
        }
      : {}),
  };

  const products = await prisma.product.findMany({
    where,
    include: {
      category: true,
      variants: {
        where: { isActive: true },
        orderBy: { priceHkd: "asc" },
      },
      allergens: { include: { allergen: true } },
    },
    orderBy: { name: "asc" },
  });

  const ranked = selectedPet
    ? [...products].sort((a, b) => {
        const pack = (product: (typeof products)[number]) =>
          product.variants.find((variant) => variant.weightGrams != null)?.weightGrams ?? null;
        return (
          scoreProductForPet(
            {
              kcalPer100g: b.kcalPer100g,
              proteinPct: b.proteinPct,
              lifeStages: b.lifeStages,
              packWeightGrams: pack(b),
            },
            selectedPet,
          ) -
          scoreProductForPet(
            {
              kcalPer100g: a.kcalPer100g,
              proteinPct: a.proteinPct,
              lifeStages: a.lifeStages,
              packWeightGrams: pack(a),
            },
            selectedPet,
          )
        );
      })
    : products;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold">全部商品</h1>
      <p className="mt-2 text-zinc-600">
        依品種、生命階段與過敏原智慧篩選；登入後可直接套用寵物檔案，並依每日熱量吻合排序。
      </p>

      <form className="mt-6 grid gap-3 rounded-2xl border border-amber-100 bg-white p-4 md:grid-cols-5">
        {category ? <input type="hidden" name="category" value={category} /> : null}
        <input
          name="q"
          defaultValue={q}
          placeholder="搜尋商品 / 品牌"
          className="rounded-lg border border-amber-200 px-3 py-2 text-sm"
        />
        <select
          name="species"
          defaultValue={speciesFilter ?? ""}
          className="rounded-lg border border-amber-200 px-3 py-2 text-sm"
        >
          <option value="">全部品種</option>
          {Object.entries(PET_SPECIES_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          name="lifeStage"
          defaultValue={lifeStageFilter ?? ""}
          className="rounded-lg border border-amber-200 px-3 py-2 text-sm"
        >
          <option value="">全部階段</option>
          {LIFE_STAGE_GROUPS.map((group) => (
            <optgroup key={group.species} label={group.label}>
              {group.stages.map((stage) => (
                <option key={stage.value} value={stage.value}>
                  {stage.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <select
          name="allergen"
          defaultValue={allergen ?? ""}
          className="rounded-lg border border-amber-200 px-3 py-2 text-sm"
        >
          <option value="">不過濾過敏原</option>
          {allergens.map((item) => (
            <option key={item.id} value={item.nameZh ?? item.name}>
              排除 {item.nameZh ?? item.name}
            </option>
          ))}
        </select>
        {pets.length > 0 ? (
          <select
            name="petId"
            defaultValue={petId ?? ""}
            className="rounded-lg border border-amber-200 px-3 py-2 text-sm"
          >
            <option value="">不套用寵物檔案</option>
            {pets.map((pet) => (
              <option key={pet.id} value={pet.id}>
                為 {pet.name} 篩選
              </option>
            ))}
          </select>
        ) : (
          <button
            type="submit"
            className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white"
          >
            套用篩選
          </button>
        )}
        {pets.length > 0 && (
          <button
            type="submit"
            className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white md:col-span-5"
          >
            套用篩選
          </button>
        )}
      </form>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href="/products"
          className={`rounded-full px-4 py-1.5 text-sm font-medium ${
            !category
              ? "bg-amber-600 text-white"
              : "bg-white text-zinc-700 ring-1 ring-amber-100"
          }`}
        >
          全部
        </Link>
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`/products?category=${cat.slug}`}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              category === cat.slug
                ? "bg-amber-600 text-white"
                : "bg-white text-zinc-700 ring-1 ring-amber-100"
            }`}
          >
            {cat.name}
          </Link>
        ))}
      </div>

      {ranked.length > 0 ? (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {ranked.map((product) => {
            const variant = product.variants[0];
            if (!variant) return null;
            const packWeightGrams =
              product.variants.find((item) => item.weightGrams != null)?.weightGrams ?? null;
            return (
              <div key={product.id}>
                <ProductCard
                  slug={product.slug}
                  name={product.name}
                  brand={product.brand}
                  imageUrl={product.imageUrl}
                  priceHkd={variant.priceHkd}
                  compareAtPrice={variant.compareAtPrice}
                  caption={
                    selectedPet
                      ? nutritionCaption(
                          { kcalPer100g: product.kcalPer100g, packWeightGrams },
                          selectedPet,
                        )
                      : undefined
                  }
                />
                {product.allergens.length > 0 && (
                  <p className="mt-1 px-1 text-xs text-zinc-500">
                    含：{product.allergens.map((a) => a.allergen.nameZh ?? a.allergen.name).join("、")}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-12 text-center text-zinc-500">找不到符合條件的商品。</p>
      )}
    </div>
  );
}
