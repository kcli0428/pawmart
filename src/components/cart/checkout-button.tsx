"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { checkoutAction, type CheckoutState } from "@/app/cart/actions";
import { formatHkd } from "@/lib/utils";

export function CheckoutButton({
  subtotalHkd,
  pointsBalance,
  maxRedeemPoints,
}: {
  subtotalHkd: number;
  pointsBalance: number;
  maxRedeemPoints: number;
}) {
  const [state, formAction, pending] = useActionState<CheckoutState, FormData>(
    checkoutAction,
    null,
  );
  const [usePoints, setUsePoints] = useState(false);
  const discount = usePoints ? maxRedeemPoints : 0;
  const payable = Math.max(0, subtotalHkd - discount);

  return (
    <form action={formAction} className="mt-4">
      {maxRedeemPoints > 0 && (
        <label className="mb-3 flex items-start gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            name="usePoints"
            checked={usePoints}
            onChange={(event) => setUsePoints(event.target.checked)}
            className="mt-1"
          />
          <span>
            使用 {maxRedeemPoints} 點折抵 {formatHkd(maxRedeemPoints)}
            <span className="block text-xs text-zinc-500">
              目前 {pointsBalance} 點 · 100 點 = HK$1
            </span>
          </span>
        </label>
      )}
      {usePoints && (
        <div className="mb-3 flex justify-between text-sm text-zinc-600">
          <span>折抵後應付</span>
          <span className="font-semibold text-amber-700">{formatHkd(payable)}</span>
        </div>
      )}
      {state?.error && <p className="mb-2 text-sm text-red-600">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "結帳中…" : `確認結帳（${formatHkd(payable)}）`}
      </Button>
      <p className="mt-2 text-center text-xs text-zinc-500">
        尚未設定 Stripe 時會以示範結帳完成訂單，並以 FEFO 扣減批號庫存。
      </p>
    </form>
  );
}
