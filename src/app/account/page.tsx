import Link from "next/link";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { POINTS_TIER_LABELS } from "@/lib/constants";

export default async function AccountHomePage() {
  const session = await requireUser();

  const [orders, subscriptions, points, pets, addresses] = await Promise.all([
    prisma.order.count({ where: { userId: session.user.id } }),
    prisma.subscription.count({
      where: { userId: session.user.id, status: "ACTIVE" },
    }),
    prisma.pointsAccount.findUnique({ where: { userId: session.user.id } }),
    prisma.pet.count({ where: { userId: session.user.id } }),
    prisma.address.count({ where: { userId: session.user.id } }),
  ]);

  return (
    <div>
      <h1 className="text-3xl font-bold">會員中心</h1>
      <p className="mt-1 text-zinc-600">管理寵物檔案、訂單、訂閱與點數</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "寵物檔案", value: pets, href: "/account/pets" },
          { label: "訂單", value: orders, href: "/account/orders" },
          { label: "送貨地址", value: addresses, href: "/account/addresses" },
          { label: "進行中訂閱", value: subscriptions, href: "/account/subscriptions" },
          {
            label: `${POINTS_TIER_LABELS[points?.tier ?? "BRONZE"]}點數`,
            value: points?.balance ?? 0,
            href: "/account/points",
          },
        ].map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-2xl border border-amber-100 bg-white p-6 hover:shadow-md"
          >
            <p className="text-2xl font-bold text-amber-700">{card.value}</p>
            <p className="mt-1 text-sm text-zinc-600">{card.label}</p>
          </Link>
        ))}
      </div>
        <p className="mt-8 text-sm text-zinc-500">每消費 HK$1 累積 1 點；結帳時 100 點可折抵 HK$1。</p>
    </div>
  );
}
