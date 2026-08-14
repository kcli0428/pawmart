import Link from "next/link";
import { ArrowRight, Heart, Shield, Sparkles, Truck } from "lucide-react";
import { ProductCard } from "@/components/products/product-card";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { sortCategories } from "@/lib/constants";
import { auth } from "@/lib/auth";
import { getRecommendationsForPet } from "@/lib/recommendations";

export default async function HomePage() {
  const session = await auth();
  const firstPet = session?.user
    ? await prisma.pet.findFirst({
        where: { userId: session.user.id },
        orderBy: { createdAt: "asc" },
      })
    : null;
  const personalized = firstPet ? await getRecommendationsForPet(firstPet, 4) : [];

  const featuredProducts = await prisma.product.findMany({
    where: { isActive: true },
    include: {
      variants: {
        where: { isActive: true },
        orderBy: { priceHkd: "asc" },
        take: 1,
      },
    },
    take: 4,
    orderBy: { createdAt: "desc" },
  });

  const categories = sortCategories(
    await prisma.category.findMany({
      where: { parentId: null },
    }),
  );

  return (
    <div>
      <section className="relative overflow-hidden bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 text-white">
        <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
          <div className="max-w-2xl">
            <p className="mb-3 text-sm font-medium uppercase tracking-widest text-amber-100">
              香港寵物用品零售平台
            </p>
            <h1 className="text-4xl font-bold leading-tight md:text-5xl">
              為每一隻毛孩，
              <br />
              打造專屬購物體驗
            </h1>
            <p className="mt-4 text-lg text-amber-50/90">
              多寵物檔案、過敏原避障、營養推薦、訂閱補貨 — 一站式照顧你家的每一位成員。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/products">
                <Button size="lg" className="bg-white text-amber-700 hover:bg-amber-50">
                  開始選購
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/account/pets">
                <Button size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10">
                  建立寵物檔案
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-2xl font-bold">為什麼選擇 PawMart？</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Sparkles, title: "個人化推薦", desc: "依寵物品種、年齡與過敏原智慧篩選" },
            { icon: Heart, title: "多寵物檔案", desc: "一個帳戶管理多隻毛孩的偏好與紀錄" },
            { icon: Truck, title: "訂閱補貨", desc: "自動定期配送，快吃完時提醒你" },
            { icon: Shield, title: "品質把關", desc: "批號追蹤、有效期限管理、香港本地配送" },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-2xl border border-amber-100 bg-white p-6">
              <Icon className="h-8 w-8 text-amber-600" />
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-zinc-600">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {categories.length > 0 && (
        <section className="bg-white py-16">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-2xl font-bold">熱門分類</h2>
            <div className="mt-6 flex flex-wrap gap-3">
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/products?category=${cat.slug}`}
                  className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-bold">
            {firstPet ? `為 ${firstPet.name} 精選` : "精選商品"}
          </h2>
          <Link
            href={firstPet ? `/products?petId=${firstPet.id}` : "/products"}
            className="text-sm font-medium text-amber-700 hover:underline"
          >
            查看全部 →
          </Link>
        </div>
        {(personalized.length > 0 ? personalized : featuredProducts).length > 0 ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {(personalized.length > 0 ? personalized : featuredProducts).map((product) => {
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
                  compareAtPrice={variant.compareAtPrice}
                  caption={"caption" in product ? product.caption : undefined}
                />
              );
            })}
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed border-amber-200 bg-white p-12 text-center">
            <p className="text-zinc-500">尚未有商品資料。請執行 seed 或於後台新增商品。</p>
            <Link href="/admin/products" className="mt-4 inline-block text-amber-700 hover:underline">
              前往後台 →
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
