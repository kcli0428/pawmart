import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatHkd } from "@/lib/utils";
import { ORDER_STATUS_LABELS } from "@/lib/constants";

type Props = { params: Promise<{ id: string }> };

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await requireUser();
  const order = await prisma.order.findFirst({
    where: { id, userId: session.user.id },
    include: {
      items: {
        include: {
          variant: { include: { product: true } },
          deductions: { include: { lot: true } },
        },
      },
    },
  });

  if (!order) notFound();

  return (
    <div>
      <Link href="/account/orders" className="text-sm text-amber-700 hover:underline">
        ← 返回訂單列表
      </Link>
      <h1 className="mt-2 text-3xl font-bold">{order.orderNumber}</h1>
      <p className="mt-1 text-zinc-600">
        {order.createdAt.toLocaleString("zh-HK")} · {ORDER_STATUS_LABELS[order.status]}
      </p>
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
      <p className="mt-6 text-right text-lg font-bold">
        合計 {formatHkd(order.totalHkd)}
      </p>
    </div>
  );
}
