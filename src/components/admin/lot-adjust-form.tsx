"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  adjustLotQuantityAction,
  type AdminActionState,
} from "@/app/admin/actions";

export function LotAdjustForm({
  lotId,
  quantity,
}: {
  lotId: string;
  quantity: number;
}) {
  const [state, formAction, pending] = useActionState<AdminActionState, FormData>(
    adjustLotQuantityAction,
    null,
  );

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="lotId" value={lotId} />
      <input
        name="quantity"
        type="number"
        min={0}
        defaultValue={quantity}
        className="w-20 rounded-lg border border-amber-200 px-2 py-1 text-sm"
      />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "儲存中…" : "盤點"}
      </Button>
      {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
      {state?.ok && <span className="text-xs text-green-700">{state.ok}</span>}
    </form>
  );
}
