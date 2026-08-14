import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { updateOrderStatusAction } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatHkd } from "@/lib/utils";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import { formatShippingAddress } from "@/lib/addresses";
import type { OrderStatus } from "@/generated/prisma/client";

type Props = { params: Promise<{ id: string }> };

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  PAID: ["PROCESSING", "SHIPPED"],
  PROCESSING: ["SHIPPED"],
  SHIPPED: ["DELIVERED"],
};

export default async function AdminOrderDetailPage({ params }: Props) {
  const { id } = await params;
  await requireAdmin();

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      user: true,
      items: {
        include: {
          variant: { include: { product: true } },
          deductions: { include: { lot: true } },
        },
      },
    },
  });

  if (!order) notFound();

  const nextStatuses = NEXT_STATUS[order.status] ?? [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/admin/orders" className="text-sm text-amber-700 hover:underline">
        ← 返回訂單列表
      </Link>
      <h1 className="mt-2 text-3xl font-bold">{order.orderNumber}</h1>
      <p className="mt-1 text-zinc-600">
        {order.createdAt.toLocaleString("zh-HK")} · {ORDER_STATUS_LABELS[order.status]}
      </p>
      <p className="mt-2 text-sm text-zinc-600">
        會員：{order.user.name ?? "—"}（{order.user.email}）
      </p>
      {formatShippingAddress(order.shippingAddress) && (
        <p className="mt-1 text-sm text-zinc-600">
          送貨：{formatShippingAddress(order.shippingAddress)}
        </p>
      )}

      {nextStatuses.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {nextStatuses.map((status) => (
            <form key={status} action={updateOrderStatusAction}>
              <input type="hidden" name="id" value={order.id} />
              <input type="hidden" name="status" value={status} />
              <Button type="submit" size="sm">
                標記為{ORDER_STATUS_LABELS[status]}
              </Button>
            </form>
          ))}
        </div>
      )}

      <div className="mt-6 space-y-3">
        {order.items.map((item) => (
          <div key={item.id} className="rounded-xl border border-amber-100 bg-white p-4">
            <div className="flex justify-between">
              <div>
                <p className="font-medium">{item.variant.product.name}</p>
                <p className="text-sm text-zinc-500">
                  {item.variant.name} × {item.quantity}
                </p>
              </div>
              <p className="font-semibold text-amber-700">
                {formatHkd(item.priceHkd * item.quantity)}
              </p>
            </div>
            {item.deductions.length > 0 && (
              <p className="mt-2 text-xs text-zinc-500">
                FEFO 批號：
                {item.deductions
                  .map((d) => `${d.lot.lotNumber}（${d.quantity}）`)
                  .join("、")}
              </p>
            )}
          </div>
        ))}
      </div>
      <p className="mt-6 text-right text-sm text-zinc-600">
        小計 {formatHkd(order.subtotalHkd)}
        {order.discountHkd > 0 ? ` · 點數折抵 −${formatHkd(order.discountHkd)}` : ""}
      </p>
      <p className="mt-1 text-right text-lg font-bold">合計 {formatHkd(order.totalHkd)}</p>
    </div>
  );
}
