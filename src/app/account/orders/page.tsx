import Link from "next/link";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatHkd } from "@/lib/utils";
import { ORDER_STATUS_LABELS } from "@/lib/constants";

export default async function OrdersPage() {
  const session = await requireUser();
  const orders = await prisma.order.findMany({
    where: { userId: session.user.id },
    include: { items: { include: { variant: { include: { product: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="text-3xl font-bold">我的訂單</h1>
      {orders.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-amber-200 bg-white p-8 text-center text-zinc-500">
          尚無訂單。{" "}
          <Link href="/products" className="text-amber-700 hover:underline">
            去逛逛
          </Link>
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/account/orders/${order.id}`}
              className="block rounded-2xl border border-amber-100 bg-white p-5 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{order.orderNumber}</p>
                  <p className="text-sm text-zinc-500">
                    {order.createdAt.toLocaleString("zh-HK")} ·{" "}
                    {ORDER_STATUS_LABELS[order.status]}
                  </p>
                </div>
                <p className="font-bold text-amber-700">{formatHkd(order.totalHkd)}</p>
              </div>
              <p className="mt-2 text-sm text-zinc-600">
                {order.items.map((item) => item.variant.product.name).join("、")}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
