import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatHkd } from "@/lib/utils";
import { UNIT_TYPE_LABELS } from "@/lib/constants";

export default async function AdminProductsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/");

  const products = await prisma.product.findMany({
    include: {
      category: true,
      variants: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin" className="text-sm text-amber-700 hover:underline">
            ← 返回後台
          </Link>
          <h1 className="mt-2 text-3xl font-bold">商品管理</h1>
        </div>
      </div>

      <div className="mt-8 overflow-x-auto rounded-2xl border border-amber-100 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-amber-100 bg-amber-50/50">
            <tr>
              <th className="px-4 py-3 font-medium">商品</th>
              <th className="px-4 py-3 font-medium">分類</th>
              <th className="px-4 py-3 font-medium">規格</th>
              <th className="px-4 py-3 font-medium">庫存</th>
              <th className="px-4 py-3 font-medium">狀態</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) =>
              product.variants.map((variant, idx) => (
                <tr key={variant.id} className="border-b border-amber-50">
                  {idx === 0 && (
                    <td className="px-4 py-3" rowSpan={product.variants.length}>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-xs text-zinc-500">{product.brand}</p>
                    </td>
                  )}
                  {idx === 0 && (
                    <td className="px-4 py-3" rowSpan={product.variants.length}>
                      {product.category?.name ?? "—"}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <p>{variant.name}</p>
                    <p className="text-xs text-zinc-500">
                      {UNIT_TYPE_LABELS[variant.unitType]} · {formatHkd(variant.priceHkd)}
                    </p>
                  </td>
                  <td className="px-4 py-3">{variant.stockQuantity}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        product.isActive && variant.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {product.isActive && variant.isActive ? "上架" : "下架"}
                    </span>
                  </td>
                </tr>
              )),
            )}
          </tbody>
        </table>
        {products.length === 0 && (
          <p className="p-8 text-center text-zinc-500">尚無商品，請執行 npm run db:seed</p>
        )}
      </div>
    </div>
  );
}
