import Link from "next/link";
import { ProductForm } from "@/components/admin/product-form";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export default async function NewProductPage() {
  await requireAdmin();
  const [categories, allergens] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.allergen.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link href="/admin/products" className="text-sm text-amber-700 hover:underline">
        ← 返回商品列表
      </Link>
      <h1 className="mt-2 text-3xl font-bold">新增商品</h1>
      <p className="mt-1 text-sm text-zinc-600">
        輸入名稱後按「搜尋並填入」，可從品牌官網帶出分類、成份、保證分析與規格。
      </p>
      <div className="mt-8 rounded-2xl border border-amber-100 bg-white p-6">
        <ProductForm categories={categories} allergens={allergens} />
      </div>
    </div>
  );
}
