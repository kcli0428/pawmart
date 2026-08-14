import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductForm } from "@/components/admin/product-form";
import { Button } from "@/components/ui/button";
import { deactivateProductAction } from "@/app/admin/product-actions";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { sortCategories } from "@/lib/constants";

type Props = { params: Promise<{ id: string }> };

export default async function EditProductPage({ params }: Props) {
  const { id } = await params;
  await requireAdmin();

  const [product, categories, allergens] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        variants: { orderBy: { sku: "asc" } },
        allergens: true,
      },
    }),
    prisma.category.findMany(),
    prisma.allergen.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!product) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link href="/admin/products" className="text-sm text-amber-700 hover:underline">
        ← 返回商品列表
      </Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">編輯商品</h1>
        {product.isActive && (
          <form action={deactivateProductAction}>
            <input type="hidden" name="id" value={product.id} />
            <Button type="submit" size="sm" variant="outline">
              下架
            </Button>
          </form>
        )}
      </div>
      <div className="mt-8 rounded-2xl border border-amber-100 bg-white p-6">
        <ProductForm
          categories={sortCategories(categories)}
          allergens={allergens}
          product={{
            id: product.id,
            name: product.name,
            slug: product.slug,
            brand: product.brand,
            description: product.description,
            categoryId: product.categoryId,
            imageUrl: product.imageUrl,
            isActive: product.isActive,
            proteinPct: product.proteinPct,
            fatPct: product.fatPct,
            fiberPct: product.fiberPct,
            moisturePct: product.moisturePct,
            ashPct: product.ashPct,
            taurinePct: product.taurinePct,
            kcalPer100g: product.kcalPer100g,
            chondroitinMgPerKg: product.chondroitinMgPerKg,
            glucosamineMgPerKg: product.glucosamineMgPerKg,
            ingredients: product.ingredients,
            suitableFor: product.suitableFor,
            lifeStages: product.lifeStages,
            allergenIds: product.allergens.map((item) => item.allergenId),
            variants: product.variants.map((variant) => ({
              id: variant.id,
              sku: variant.sku,
              name: variant.name,
              unitType: variant.unitType,
              unitsPerCase: variant.unitsPerCase,
              priceDollars: (variant.priceHkd / 100).toFixed(2),
              isActive: variant.isActive,
            })),
          }}
        />
      </div>
    </div>
  );
}
