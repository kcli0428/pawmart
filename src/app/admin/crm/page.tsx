import Link from "next/link";
import { generateCampaignsAction, processDueSubscriptionsAction, sendCampaignAction, sendPendingCampaignsAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import {
  CAMPAIGN_TYPE_LABELS,
  LIFE_STAGE_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
} from "@/lib/constants";
import {
  getLifeStageSuggestions,
  getRunningLowAlerts,
  getUpcomingBirthdays,
} from "@/lib/campaigns";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export default async function AdminCrmPage() {
  await requireAdmin();

  const [runningLow, birthdays, stages, campaigns, subscriptions] = await Promise.all([
    getRunningLowAlerts(),
    getUpcomingBirthdays(),
    getLifeStageSuggestions(),
    prisma.campaign.findMany({
      include: { user: true, pet: true },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.subscription.findMany({
      include: {
        user: true,
        pet: true,
        variant: { include: { product: true } },
      },
      orderBy: { nextDeliveryAt: "asc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link href="/admin" className="text-sm text-amber-700 hover:underline">
        ← 返回後台
      </Link>
      <h1 className="mt-2 text-3xl font-bold">CRM 與自動化行銷</h1>
      <p className="mt-1 text-zinc-600">
        「快吃完了」催購、生日與生命階段行銷；未設定 RESEND_API_KEY 時改為模擬發送
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <form action={generateCampaignsAction}>
          <Button type="submit">產生行銷活動</Button>
        </form>
        <form action={sendPendingCampaignsAction}>
          <Button type="submit" variant="outline">
            發送待發送電郵
          </Button>
        </form>
        <form action={processDueSubscriptionsAction}>
          <Button type="submit" variant="outline">
            處理到期訂閱
          </Button>
        </form>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-amber-100 bg-white p-5">
          <h2 className="font-semibold">快吃完了</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {runningLow.length === 0 && <li className="text-zinc-500">目前無催購對象</li>}
            {runningLow.map((alert) => (
              <li key={`${alert.pet.id}-${alert.productName}-${alert.source}`}>
                <span className="font-medium">{alert.pet.name}</span>
                <span className="text-zinc-500"> · {alert.productName}</span>
                <span className="text-orange-600"> · 剩 {alert.daysRemaining} 天</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl border border-amber-100 bg-white p-5">
          <h2 className="font-semibold">即將生日</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {birthdays.length === 0 && <li className="text-zinc-500">未來 14 天無生日</li>}
            {birthdays.map((item) => (
              <li key={item.pet.id}>
                <span className="font-medium">{item.pet.name}</span>
                <span className="text-zinc-500">
                  {" "}
                  · {item.daysUntil === 0 ? "今天" : `${item.daysUntil} 天後`}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl border border-amber-100 bg-white p-5">
          <h2 className="font-semibold">生命階段建議</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {stages.length === 0 && <li className="text-zinc-500">無需更新</li>}
            {stages.map((item) => (
              <li key={item.pet.id}>
                <span className="font-medium">{item.pet.name}</span>
                <span className="text-zinc-500">
                  {" "}
                  · {item.current ? LIFE_STAGE_LABELS[item.current] : "未設定"} →{" "}
                  {LIFE_STAGE_LABELS[item.suggested]}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <h2 className="mt-10 text-xl font-semibold">訂閱清單</h2>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-amber-100 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-amber-100 bg-amber-50/50">
            <tr>
              <th className="px-4 py-3">會員</th>
              <th className="px-4 py-3">商品</th>
              <th className="px-4 py-3">下次配送</th>
              <th className="px-4 py-3">狀態</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.map((sub) => (
              <tr key={sub.id} className="border-b border-amber-50">
                <td className="px-4 py-3">{sub.user.email}</td>
                <td className="px-4 py-3">
                  {sub.variant.product.name}
                  {sub.pet ? ` · ${sub.pet.name}` : ""}
                </td>
                <td className="px-4 py-3">{sub.nextDeliveryAt.toLocaleDateString("zh-HK")}</td>
                <td className="px-4 py-3">{SUBSCRIPTION_STATUS_LABELS[sub.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {subscriptions.length === 0 && (
          <p className="p-8 text-center text-zinc-500">尚無訂閱</p>
        )}
      </div>

      <h2 className="mt-10 text-xl font-semibold">行銷活動</h2>
      <div className="mt-4 space-y-3">
        {campaigns.length === 0 && (
          <p className="rounded-2xl border border-dashed border-amber-200 bg-white p-8 text-center text-zinc-500">
            尚無活動，請先按「產生行銷活動」。
          </p>
        )}
        {campaigns.map((campaign) => (
          <div
            key={campaign.id}
            className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-amber-100 bg-white p-5"
          >
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-amber-600">
                {CAMPAIGN_TYPE_LABELS[campaign.type]} · {campaign.status === "SENT" ? "已發送" : "待發送"}
              </p>
              <p className="mt-1 font-semibold">{campaign.title}</p>
              <p className="mt-1 text-sm text-zinc-600">{campaign.body}</p>
              <p className="mt-1 text-xs text-zinc-500">{campaign.user.email}</p>
            </div>
            {campaign.status === "PENDING" && (
              <form action={sendCampaignAction}>
                <input type="hidden" name="id" value={campaign.id} />
                <Button type="submit" size="sm" variant="outline">
                  發送電郵
                </Button>
              </form>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
