import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatHkd } from "@/lib/utils";
import {
  LIFE_STAGE_LABELS,
  ORDER_STATUS_LABELS,
  PET_SPECIES_LABELS,
  POINTS_TIER_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
} from "@/lib/constants";

type Props = { params: Promise<{ id: string }> };

export default async function AdminMemberDetailPage({ params }: Props) {
  const { id } = await params;
  await requireAdmin();

  const member = await prisma.user.findUnique({
    where: { id },
    include: {
      pets: { orderBy: { createdAt: "asc" } },
      orders: { orderBy: { createdAt: "desc" }, take: 20 },
      subscriptions: {
        include: { variant: { include: { product: true } }, pet: true },
        orderBy: { createdAt: "desc" },
      },
      pointsAccount: true,
    },
  });

  if (!member) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link href="/admin/members" className="text-sm text-amber-700 hover:underline">
        ← 返回會員列表
      </Link>
      <h1 className="mt-2 text-3xl font-bold">{member.name ?? "未命名會員"}</h1>
      <p className="mt-1 text-zinc-600">
        {member.email} · {member.role === "ADMIN" ? "管理員" : "會員"}
      </p>
      {member.pointsAccount && (
        <p className="mt-2 text-sm text-amber-700">
          {POINTS_TIER_LABELS[member.pointsAccount.tier]} · {member.pointsAccount.balance} 點
        </p>
      )}

      <h2 className="mt-8 text-xl font-semibold">寵物檔案</h2>
      {member.pets.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">尚未建立寵物檔案</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {member.pets.map((pet) => (
            <li key={pet.id} className="rounded-xl border border-amber-100 bg-white p-4 text-sm">
              <p className="font-medium">{pet.name}</p>
              <p className="text-zinc-500">
                {PET_SPECIES_LABELS[pet.species]}
                {pet.breed ? ` · ${pet.breed}` : ""}
                {pet.lifeStage ? ` · ${LIFE_STAGE_LABELS[pet.lifeStage]}` : ""}
                {pet.weightKg ? ` · ${pet.weightKg} kg` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-8 text-xl font-semibold">訂單</h2>
      {member.orders.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">尚無訂單</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {member.orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/admin/orders/${order.id}`}
                className="flex justify-between rounded-xl border border-amber-100 bg-white p-4 text-sm hover:shadow-md"
              >
                <span>
                  {order.orderNumber} · {ORDER_STATUS_LABELS[order.status]}
                </span>
                <span className="font-medium text-amber-700">{formatHkd(order.totalHkd)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-8 text-xl font-semibold">訂閱</h2>
      {member.subscriptions.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">尚無訂閱</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {member.subscriptions.map((sub) => (
            <li key={sub.id} className="rounded-xl border border-amber-100 bg-white p-4">
              {sub.variant.product.name} · {SUBSCRIPTION_STATUS_LABELS[sub.status]}
              {sub.pet ? ` · ${sub.pet.name}` : ""} · 下次{" "}
              {sub.nextDeliveryAt.toLocaleDateString("zh-HK")}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
