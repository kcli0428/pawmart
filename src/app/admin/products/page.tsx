import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatHkd } from "@/lib/utils";
import { UNIT_TYPE_LABELS, sortCategories } from "@/lib/constants";
import { AdminProductToolbar } from "@/components/admin/product-toolbar";
import {
  adminProductOrderBy,
  adminProductQueryIsFiltered,
  adminProductWhere,
  parseAdminProductQuery,
  sortAdminProducts,
} from "@/lib/admin-products";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminProductsPage({ searchParams }: Props) {
  await requireAdmin();
  const query = parseAdminProductQuery(await searchParams);
  const stockSort = query.sort === "stockAsc" || query.sort === "stockDesc";

  const [rawCategories, products] = await Promise.all([
    prisma.category.findMany(),
    prisma.product.findMany({
      where: adminProductWhere(query),
      include: {
        category: true,
        variants: true,
      },
      orderBy: stockSort ? { name: "asc" } : adminProductOrderBy(query.sort),
    }),
  ]);
  const categories = sortCategories(rawCategories);
  const rows = sortAdminProducts(products, query.sort);
  const filtered = adminProductQueryIsFiltered(query);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link href="/admin" className="text-sm text-amber-700 hover:underline">
            ← 返回後台
          </Link>
          <h1 className="mt-2 text-3xl font-bold">商品管理</h1>
        </div>
        <Link
          href="/admin/products/new"
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
        >
          新增商品
        </Link>
      </div>

      <AdminProductToolbar query={query} categories={categories} />
      <p className="mt-3 text-sm text-zinc-500">
        {filtered ? `找到 ${rows.length} 件商品` : `共 ${rows.length} 件商品`}
      </p>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-amber-100 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-amber-100 bg-amber-50/50">
            <tr>
              <th className="px-4 py-3 font-medium">商品</th>
              <th className="px-4 py-3 font-medium">分類</th>
              <th className="px-4 py-3 font-medium">規格</th>
              <th className="px-4 py-3 font-medium">庫存</th>
              <th className="px-4 py-3 font-medium">狀態</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((product) =>
              (product.variants.length > 0 ? product.variants : [null]).map((variant, idx) => (
                <tr key={variant?.id ?? product.id} className="border-b border-amber-50">
                  {idx === 0 && (
                    <td
                      className="px-4 py-3"
                      rowSpan={Math.max(product.variants.length, 1)}
                    >
                      <p className="font-medium">{product.name}</p>
                      <p className="text-xs text-zinc-500">{product.brand}</p>
                    </td>
                  )}
                  {idx === 0 && (
                    <td
                      className="px-4 py-3"
                      rowSpan={Math.max(product.variants.length, 1)}
                    >
                      {product.category?.name ?? "—"}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    {variant ? (
                      <>
                        <p>{variant.name}</p>
                        <p className="text-xs text-zinc-500">
                          {UNIT_TYPE_LABELS[variant.unitType]} · {formatHkd(variant.priceHkd)}
                        </p>
                      </>
                    ) : (
                      <p className="text-zinc-400">尚無規格</p>
                    )}
                  </td>
                  <td className="px-4 py-3">{variant?.stockQuantity ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        product.isActive && (variant?.isActive ?? true)
                          ? "bg-green-100 text-green-700"
                          : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {product.isActive && (variant?.isActive ?? true) ? "上架" : "下架"}
                    </span>
                  </td>
                  {idx === 0 && (
                    <td
                      className="px-4 py-3"
                      rowSpan={Math.max(product.variants.length, 1)}
                    >
                      <Link
                        href={`/admin/products/${product.id}`}
                        className="text-amber-700 hover:underline"
                      >
                        編輯
                      </Link>
                    </td>
                  )}
                </tr>
              )),
            )}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="p-8 text-center text-zinc-500">
            {filtered ? "沒有符合條件的商品，請改關鍵字或清除篩選。" : "尚無商品，請先新增商品。"}
          </p>
        )}
      </div>
    </div>
  );
}
