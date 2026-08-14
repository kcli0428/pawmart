import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getExpiringLots } from "@/lib/inventory";
import { ReceiveLotForm } from "@/components/admin/receive-lot-form";
import { LotAdjustForm } from "@/components/admin/lot-adjust-form";
import { TransferLotForm } from "@/components/admin/transfer-lot-form";
import { Button } from "@/components/ui/button";
import { sendExpiryAlertsAction } from "@/app/admin/actions";
import { UNIT_TYPE_LABELS } from "@/lib/constants";

export default async function AdminInventoryPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/");

  const [lots, bundles, variants] = await Promise.all([
    prisma.productLot.findMany({
      include: {
        variant: { include: { product: true } },
      },
      orderBy: { expiryDate: "asc" },
    }),
    prisma.bundleItem.findMany({
      include: {
        bundleVariant: { include: { product: true } },
        componentVariant: { include: { product: true } },
      },
    }),
    prisma.productVariant.findMany({
      include: { product: true },
      orderBy: { sku: "asc" },
    }),
  ]);

  const expiring = await getExpiringLots(30);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link href="/admin" className="text-sm text-amber-700 hover:underline">
        ← 返回後台
      </Link>
      <h1 className="mt-2 text-3xl font-bold">批號與庫存</h1>
      <p className="mt-1 text-zinc-600">
        批號追蹤、有效期限 Alert、進貨入庫、盤點調撥、組合包拆包扣減
      </p>

      <div className="mt-6 rounded-2xl border border-amber-100 bg-white p-5">
        <h2 className="text-lg font-semibold">進貨入庫</h2>
        <p className="mt-1 text-sm text-zinc-500">
          新增批號會同時增加規格庫存。入庫整箱會按每箱件數拆入相同批號／到期日的單件庫存；結帳時依
          FEFO（先到期先出）扣減。
        </p>
        <ReceiveLotForm
          variants={variants.map((variant) => ({
            id: variant.id,
            label: `${variant.product.name} — ${variant.name} (${variant.sku} · ${UNIT_TYPE_LABELS[variant.unitType]})`,
          }))}
        />
      </div>

      <div className="mt-6 rounded-2xl border border-amber-100 bg-white p-5">
        <h2 className="text-lg font-semibold">批號調撥</h2>
        <p className="mt-1 text-sm text-zinc-500">
          將數量由一個批號轉至另一個批號（同一規格）。規格總庫存不變。
        </p>
        <TransferLotForm
          lots={lots.map((lot) => ({
            id: lot.id,
            label: `${lot.variant.product.name} — ${lot.variant.name} · ${lot.lotNumber}（${lot.quantity}）`,
          }))}
        />
      </div>

      {expiring.length > 0 && (
        <div className="mt-6 rounded-2xl border border-orange-200 bg-orange-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-medium text-orange-800">
              ⚠️ {expiring.length} 個批號將於 30 天內到期
            </p>
            <form action={sendExpiryAlertsAction}>
              <Button type="submit" size="sm" variant="outline">
                發送到期預警電郵
              </Button>
            </form>
          </div>
        </div>
      )}

      <h2 className="mt-8 text-xl font-semibold">批號清單</h2>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-amber-100 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-amber-100 bg-amber-50/50">
            <tr>
              <th className="px-4 py-3">商品</th>
              <th className="px-4 py-3">批號</th>
              <th className="px-4 py-3">到期日</th>
              <th className="px-4 py-3">數量 / 盤點</th>
            </tr>
          </thead>
          <tbody>
            {lots.map((lot) => (
              <tr key={lot.id} className="border-b border-amber-50">
                <td className="px-4 py-3">
                  {lot.variant.product.name} — {lot.variant.name}
                </td>
                <td className="px-4 py-3 font-mono text-xs">{lot.lotNumber}</td>
                <td className="px-4 py-3">{lot.expiryDate.toLocaleDateString("zh-HK")}</td>
                <td className="px-4 py-3">
                  <LotAdjustForm lotId={lot.id} quantity={lot.quantity} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {lots.length === 0 && (
          <p className="p-8 text-center text-zinc-500">尚無批號資料</p>
        )}
      </div>

      <h2 className="mt-8 text-xl font-semibold">組合包設定</h2>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-amber-100 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-amber-100 bg-amber-50/50">
            <tr>
              <th className="px-4 py-3">組合包</th>
              <th className="px-4 py-3">組成 SKU</th>
              <th className="px-4 py-3">數量</th>
            </tr>
          </thead>
          <tbody>
            {bundles.map((b) => (
              <tr key={b.id} className="border-b border-amber-50">
                <td className="px-4 py-3">
                  {b.bundleVariant.product.name} — {b.bundleVariant.name}
                </td>
                <td className="px-4 py-3">
                  {b.componentVariant.product.name} — {b.componentVariant.name}
                </td>
                <td className="px-4 py-3">× {b.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {bundles.length === 0 && (
          <p className="p-8 text-center text-zinc-500">尚無組合包設定</p>
        )}
      </div>
    </div>
  );
}
