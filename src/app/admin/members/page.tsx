import Link from "next/link";
import { Users } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { POINTS_TIER_LABELS } from "@/lib/constants";

export default async function AdminMembersPage() {
  await requireAdmin();

  const members = await prisma.user.findMany({
    include: {
      _count: { select: { pets: true, orders: true, subscriptions: true } },
      pointsAccount: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link href="/admin" className="text-sm text-amber-700 hover:underline">
        ← 返回後台
      </Link>
      <h1 className="mt-2 flex items-center gap-2 text-3xl font-bold">
        <Users className="h-8 w-8 text-amber-600" />
        會員管理
      </h1>
      <p className="mt-1 text-zinc-600">共 {members.length} 個帳戶</p>

      <div className="mt-8 overflow-x-auto rounded-2xl border border-amber-100 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-amber-100 bg-amber-50/50">
            <tr>
              <th className="px-4 py-3 font-medium">會員</th>
              <th className="px-4 py-3 font-medium">角色</th>
              <th className="px-4 py-3 font-medium">寵物</th>
              <th className="px-4 py-3 font-medium">訂單</th>
              <th className="px-4 py-3 font-medium">訂閱</th>
              <th className="px-4 py-3 font-medium">點數</th>
              <th className="px-4 py-3 font-medium">註冊</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-b border-amber-50">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/members/${member.id}`}
                    className="font-medium text-amber-700 hover:underline"
                  >
                    {member.name ?? "未命名"}
                  </Link>
                  <p className="text-xs text-zinc-500">{member.email}</p>
                </td>
                <td className="px-4 py-3">
                  {member.role === "ADMIN" ? "管理員" : "會員"}
                </td>
                <td className="px-4 py-3">{member._count.pets}</td>
                <td className="px-4 py-3">{member._count.orders}</td>
                <td className="px-4 py-3">{member._count.subscriptions}</td>
                <td className="px-4 py-3">
                  {member.pointsAccount
                    ? `${POINTS_TIER_LABELS[member.pointsAccount.tier]} · ${member.pointsAccount.balance}`
                    : "—"}
                </td>
                <td className="px-4 py-3 text-zinc-500">
                  {member.createdAt.toLocaleDateString("zh-HK")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {members.length === 0 && (
          <p className="p-8 text-center text-zinc-500">尚無會員，請執行 npm run db:seed</p>
        )}
      </div>
    </div>
  );
}
