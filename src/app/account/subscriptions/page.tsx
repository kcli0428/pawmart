import Link from "next/link";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatHkd } from "@/lib/utils";
import { SUBSCRIPTION_STATUS_LABELS } from "@/lib/constants";
import { updateSubscriptionStatusAction } from "@/app/account/actions";
import { Button } from "@/components/ui/button";

export default async function SubscriptionsPage() {
  const session = await requireUser();
  const subscriptions = await prisma.subscription.findMany({
    where: { userId: session.user.id },
    include: {
      variant: { include: { product: true } },
      pet: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="text-3xl font-bold">定期補貨</h1>
      <p className="mt-1 text-zinc-600">自動依週期產生訂單；快到期時會出現在 CRM 催購清單。</p>
      {subscriptions.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-amber-200 bg-white p-8 text-center text-zinc-500">
          尚未設定訂閱。{" "}
          <Link href="/products" className="text-amber-700 hover:underline">
            從商品頁開始
          </Link>
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {subscriptions.map((sub) => (
            <div
              key={sub.id}
              className="rounded-2xl border border-amber-100 bg-white p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{sub.variant.product.name}</p>
                  <p className="text-sm text-zinc-500">
                    {sub.variant.name} · 每 {sub.intervalDays} 天 · × {sub.quantity}
                    {sub.pet ? ` · ${sub.pet.name}` : ""}
                  </p>
                  <p className="mt-1 text-sm text-amber-700">
                    下次配送：{sub.nextDeliveryAt.toLocaleDateString("zh-HK")}
                  </p>
                  <p className="text-sm text-zinc-600">{formatHkd(sub.variant.priceHkd)}</p>
                </div>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
                  {SUBSCRIPTION_STATUS_LABELS[sub.status]}
                </span>
              </div>
              {sub.status !== "CANCELLED" && (
                <div className="mt-4 flex gap-2">
                  {sub.status === "ACTIVE" ? (
                    <form action={updateSubscriptionStatusAction}>
                      <input type="hidden" name="id" value={sub.id} />
                      <input type="hidden" name="status" value="PAUSED" />
                      <Button type="submit" size="sm" variant="outline">
                        暫停
                      </Button>
                    </form>
                  ) : (
                    <form action={updateSubscriptionStatusAction}>
                      <input type="hidden" name="id" value={sub.id} />
                      <input type="hidden" name="status" value="ACTIVE" />
                      <Button type="submit" size="sm">
                        恢復
                      </Button>
                    </form>
                  )}
                  <form action={updateSubscriptionStatusAction}>
                    <input type="hidden" name="id" value={sub.id} />
                    <input type="hidden" name="status" value="CANCELLED" />
                    <Button type="submit" size="sm" variant="ghost">
                      取消
                    </Button>
                  </form>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
