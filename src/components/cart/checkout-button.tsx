"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { checkoutAction, type CheckoutState } from "@/app/cart/actions";

export function CheckoutButton() {
  const [state, formAction, pending] = useActionState<CheckoutState, FormData>(
    checkoutAction,
    null,
  );

  return (
    <form action={formAction} className="mt-4">
      {state?.error && <p className="mb-2 text-sm text-red-600">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "結帳中…" : "確認結帳（HKD）"}
      </Button>
      <p className="mt-2 text-center text-xs text-zinc-500">
        尚未設定 Stripe 時會以示範結帳完成訂單，並以 FEFO 扣減批號庫存。
      </p>
    </form>
  );
}
