import { ProductCard } from "@/components/products/product-card";
import { prisma } from "@/lib/prisma";

type Props = {
  searchParams: Promise<{ category?: string; q?: string }>;
};

export default async function ProductsPage({ searchParams }: Props) {
  const { category, q } = await searchParams;

  const products = await prisma.product.findMany({
    where: {
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
    },
    include: {
      category: true,
      variants: {
        where: { isActive: true },
        orderBy: { priceHkd: "asc" },
        take: 1,
      },
      allergens: { include: { allergen: true } },
    },
    orderBy: { name: "asc" },
  });

  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold">全部商品</h1>
      <p className="mt-2 text-zinc-600">
        支援品種、年齡與過敏原篩選（Phase 2）。目前可依分類瀏覽。
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <a
          href="/products"
          className={`rounded-full px-4 py-1.5 text-sm font-medium ${
            !category
              ? "bg-amber-600 text-white"
              : "bg-white text-zinc-700 ring-1 ring-amber-100"
          }`}
        >
          全部
        </a>
        {categories.map((cat) => (
          <a
            key={cat.id}
            href={`/products?category=${cat.slug}`}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              category === cat.slug
                ? "bg-amber-600 text-white"
                : "bg-white text-zinc-700 ring-1 ring-amber-100"
            }`}
          >
            {cat.name}
          </a>
        ))}
      </div>

      {products.length > 0 ? (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => {
            const variant = product.variants[0];
            if (!variant) return null;
            return (
              <div key={product.id}>
                <ProductCard
                  slug={product.slug}
                  name={product.name}
                  brand={product.brand}
                  imageUrl={product.imageUrl}
                  priceHkd={variant.priceHkd}
                  compareAtPrice={variant.compareAtPrice}
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
