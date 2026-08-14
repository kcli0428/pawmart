import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { POINTS_TIER_LABELS } from "@/lib/constants";
import { nextTier } from "@/lib/points";

export default async function PointsPage() {
  const session = await requireUser();
  const account = await prisma.pointsAccount.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id },
    update: {},
    include: { transactions: { orderBy: { createdAt: "desc" }, take: 20 } },
  });
  const upcoming = nextTier(account.balance);

  return (
    <div>
      <h1 className="text-3xl font-bold">分級寵物點數</h1>
      <div className="mt-6 rounded-2xl border border-amber-100 bg-white p-6">
        <p className="text-sm text-zinc-500">目前等級</p>
        <p className="text-3xl font-bold text-amber-700">
          {POINTS_TIER_LABELS[account.tier]} · {account.balance} 點
        </p>
        {upcoming ? (
          <p className="mt-2 text-sm text-zinc-600">
            再累積 {upcoming.remaining} 點即可升級 {POINTS_TIER_LABELS[upcoming.tier]}
          </p>
        ) : (
          <p className="mt-2 text-sm text-zinc-600">已達最高白金等級</p>
        )}
        <p className="mt-4 text-xs text-zinc-500">
          青銅 0 / 白銀 500 / 黃金 2,000 / 白金 5,000。每消費 HK$1 累積 1 點。
        </p>
      </div>
      <h2 className="mt-8 font-semibold">點數紀錄</h2>
      <ul className="mt-3 space-y-2">
        {account.transactions.length === 0 && (
          <li className="text-sm text-zinc-500">尚無紀錄</li>
        )}
        {account.transactions.map((tx) => (
          <li
            key={tx.id}
            className="flex justify-between rounded-xl border border-amber-50 bg-white px-4 py-3 text-sm"
          >
            <span>{tx.reason}</span>
            <span className="font-medium text-amber-700">+{tx.amount}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
