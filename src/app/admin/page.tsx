import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, Package, Users } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getExpiringLots } from "@/lib/inventory";

export default async function AdminDashboardPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/");

  const [productCount, orderCount, userCount, expiringLots] = await Promise.all([
    prisma.product.count(),
    prisma.order.count(),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    getExpiringLots(30),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold">後台管理</h1>
      <p className="mt-1 text-zinc-600">商品、庫存、訂單與 CRM 總覽</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          { label: "商品", value: productCount, icon: Package, href: "/admin/products" },
          { label: "訂單", value: orderCount, icon: Package, href: "/admin" },
          { label: "會員", value: userCount, icon: Users, href: "/admin" },
        ].map(({ label, value, icon: Icon, href }) => (
          <Link
            key={label}
            href={href}
            className="rounded-2xl border border-amber-100 bg-white p-6 hover:shadow-md"
          >
            <Icon className="h-6 w-6 text-amber-600" />
            <p className="mt-3 text-2xl font-bold">{value}</p>
            <p className="text-sm text-zinc-500">{label}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-amber-100 bg-white p-6">
          <h2 className="flex items-center gap-2 font-semibold">
            <Package className="h-5 w-5 text-amber-600" />
            快速連結
          </h2>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link href="/admin/products" className="text-amber-700 hover:underline">
                商品管理 →
              </Link>
            </li>
            <li>
              <Link href="/admin/inventory" className="text-amber-700 hover:underline">
                批號與庫存 →
              </Link>
            </li>
            <li>
              <Link href="/admin/crm" className="text-amber-700 hover:underline">
                CRM 與自動化行銷 →
              </Link>
            </li>
          </ul>
        </div>

        <div className="rounded-2xl border border-amber-100 bg-white p-6">
          <h2 className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            30 天內到期批號
          </h2>
          {expiringLots.length > 0 ? (
            <ul className="mt-4 space-y-2 text-sm">
              {expiringLots.slice(0, 5).map((lot) => (
                <li key={lot.id} className="flex justify-between text-zinc-600">
                  <span>
                    {lot.variant.product.name} — {lot.lotNumber}
                  </span>
                  <span className="text-orange-600">
                    {lot.expiryDate.toLocaleDateString("zh-HK")}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-zinc-500">目前無即將到期批號。</p>
          )}
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-amber-100 bg-white p-6 text-sm text-zinc-600">
        <p className="font-medium text-zinc-800">已啟用模組</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>批號 FEFO 扣減、進貨入庫、到期 Alert</li>
          <li>單罐 / 整箱 / 混搭組合包自動拆包扣庫存</li>
          <li>訂閱制定期補貨、「快吃完了」催購、生日與生命階段行銷</li>
          <li>分級寵物點數（青銅 → 白金）</li>
        </ul>
      </div>
    </div>
  );
}
