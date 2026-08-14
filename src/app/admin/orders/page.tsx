import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatHkd } from "@/lib/utils";
import { ORDER_STATUS_LABELS } from "@/lib/constants";

export default async function AdminOrdersPage() {
  await requireAdmin();

  const orders = await prisma.order.findMany({
    include: {
      user: true,
      items: { include: { variant: { include: { product: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link href="/admin" className="text-sm text-amber-700 hover:underline">
        ← 返回後台
      </Link>
      <h1 className="mt-2 flex items-center gap-2 text-3xl font-bold">
        <ClipboardList className="h-8 w-8 text-amber-600" />
        訂單管理
      </h1>
      <p className="mt-1 text-zinc-600">共 {orders.length} 筆訂單</p>

      <div className="mt-8 overflow-x-auto rounded-2xl border border-amber-100 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-amber-100 bg-amber-50/50">
            <tr>
              <th className="px-4 py-3 font-medium">訂單編號</th>
              <th className="px-4 py-3 font-medium">會員</th>
              <th className="px-4 py-3 font-medium">商品</th>
              <th className="px-4 py-3 font-medium">金額</th>
              <th className="px-4 py-3 font-medium">狀態</th>
              <th className="px-4 py-3 font-medium">時間</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-b border-amber-50">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="font-medium text-amber-700 hover:underline"
                  >
                    {order.orderNumber}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <p>{order.user.name ?? "—"}</p>
                  <p className="text-xs text-zinc-500">{order.user.email}</p>
                </td>
                <td className="px-4 py-3 text-zinc-600">
                  {order.items
                    .map((item) => `${item.variant.product.name} × ${item.quantity}`)
                    .join("、") || "—"}
                </td>
                <td className="px-4 py-3 font-semibold text-amber-700">
                  {formatHkd(order.totalHkd)}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
                    {ORDER_STATUS_LABELS[order.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-500">
                  {order.createdAt.toLocaleString("zh-HK")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && (
          <p className="p-8 text-center text-zinc-500">尚無訂單。會員結帳後會顯示於此。</p>
        )}
      </div>
    </div>
  );
}
