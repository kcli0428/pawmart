import { notFound } from "next/navigation";
import { AddToCartButton } from "@/components/products/add-to-cart-button";
import { SubscribeButton } from "@/components/products/subscribe-button";
import { formatHkd } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { PET_SPECIES_LABELS, LIFE_STAGE_LABELS } from "@/lib/constants";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;

  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      category: true,
      variants: { where: { isActive: true }, orderBy: { priceHkd: "asc" } },
      allergens: { include: { allergen: true } },
    },
  });

  if (!product) notFound();

  const session = await auth();
  const pets = session?.user
    ? await prisma.pet.findMany({
        where: { userId: session.user.id },
        select: { id: true, name: true },
      })
    : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="grid gap-10 lg:grid-cols-2">
        <div className="flex aspect-square items-center justify-center rounded-2xl bg-amber-50 text-8xl">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt={product.name}
              className="h-full w-full rounded-2xl object-cover"
            />
          ) : (
            "🐾"
          )}
        </div>

        <div>
          {product.brand && (
            <p className="text-sm font-medium uppercase tracking-wide text-amber-600">
              {product.brand}
            </p>
          )}
          <h1 className="mt-1 text-3xl font-bold">{product.name}</h1>
          {product.category && (
            <p className="mt-1 text-sm text-zinc-500">{product.category.name}</p>
          )}

          <p className="mt-4 whitespace-pre-line text-zinc-600">{product.description}</p>

          {product.ingredients && (
            <p className="mt-4 text-sm text-zinc-700">
              <span className="font-medium">主要成份：</span>
              {product.ingredients}
            </p>
          )}

          {product.suitableFor.length > 0 && (
            <p className="mt-4 text-sm">
              <span className="font-medium">適用品種：</span>
              {product.suitableFor.map((s) => PET_SPECIES_LABELS[s]).join("、")}
            </p>
          )}
          {product.lifeStages.length > 0 && (
            <p className="mt-1 text-sm">
              <span className="font-medium">適用階段：</span>
              {product.lifeStages.map((s) => LIFE_STAGE_LABELS[s]).join("、")}
            </p>
          )}
          {product.allergens.length > 0 && (
            <p className="mt-1 text-sm text-red-600">
              <span className="font-medium">過敏原：</span>
              {product.allergens.map((a) => a.allergen.nameZh ?? a.allergen.name).join("、")}
            </p>
          )}

          {(product.proteinPct ||
            product.kcalPer100g ||
            product.moisturePct ||
            product.taurinePct) && (
            <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm">
              <p className="font-medium text-amber-800">營養分析（保證分析）</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-zinc-600">
                {product.proteinPct != null && <span>粗蛋白質 {product.proteinPct}%</span>}
                {product.fatPct != null && <span>粗脂肪 {product.fatPct}%</span>}
                {product.fiberPct != null && <span>粗纖維 {product.fiberPct}%</span>}
                {product.moisturePct != null && <span>水份 {product.moisturePct}%</span>}
                {product.ashPct != null && <span>灰質 {product.ashPct}%</span>}
                {product.taurinePct != null && <span>牛磺酸 {product.taurinePct}%</span>}
                {product.chondroitinMgPerKg != null && (
                  <span>硫酸軟骨素 {product.chondroitinMgPerKg} mg/kg</span>
                )}
                {product.glucosamineMgPerKg != null && (
                  <span>葡萄糖胺 {product.glucosamineMgPerKg} mg/kg</span>
                )}
                {product.kcalPer100g != null && (
                  <span>代謝能 {product.kcalPer100g} kcal / 100g</span>
                )}
              </div>
            </div>
          )}

          <div className="mt-8 space-y-4">
            <h2 className="font-semibold">規格選擇</h2>
            {product.variants.map((variant) => (
              <div
                key={variant.id}
                className="flex items-center justify-between rounded-xl border border-amber-100 bg-white p-4"
              >
                <div>
                  <p className="font-medium">{variant.name}</p>
                  <p className="text-xs text-zinc-500">SKU: {variant.sku}</p>
                  <p className="mt-1 text-lg font-bold text-amber-700">
                    {formatHkd(variant.priceHkd)}
                    {variant.compareAtPrice && (
                      <span className="ml-2 text-sm font-normal text-zinc-400 line-through">
                        {formatHkd(variant.compareAtPrice)}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-zinc-500">
                    庫存：{variant.stockQuantity > 0 ? `${variant.stockQuantity} 件` : "缺貨"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <AddToCartButton
                    variantId={variant.id}
                    disabled={variant.stockQuantity <= 0}
                  />
                  {session?.user ? (
                    <SubscribeButton variantId={variant.id} pets={pets} />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
