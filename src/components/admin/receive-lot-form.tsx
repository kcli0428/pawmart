"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { receiveLotAction, type AdminActionState } from "@/app/admin/actions";

type VariantOption = { id: string; label: string };

export function ReceiveLotForm({ variants }: { variants: VariantOption[] }) {
  const [state, formAction, pending] = useActionState<AdminActionState, FormData>(
    receiveLotAction,
    null,
  );

  return (
    <form action={formAction} className="mt-4 grid gap-3 md:grid-cols-4">
      <select
        name="variantId"
        required
        className="rounded-lg border border-amber-200 px-3 py-2 text-sm"
      >
        <option value="">選擇規格</option>
        {variants.map((variant) => (
          <option key={variant.id} value={variant.id}>
            {variant.label}
          </option>
        ))}
      </select>
      <input
        name="lotNumber"
        required
        placeholder="批號 Lot Number"
        className="rounded-lg border border-amber-200 px-3 py-2 text-sm"
      />
      <input
        name="expiryDate"
        type="date"
        required
        className="rounded-lg border border-amber-200 px-3 py-2 text-sm"
      />
      <input
        name="quantity"
        type="number"
        min={1}
        required
        placeholder="數量"
        className="rounded-lg border border-amber-200 px-3 py-2 text-sm"
      />
      <div className="md:col-span-4 flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "入庫中…" : "進貨入庫"}
        </Button>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state?.ok && <p className="text-sm text-green-700">{state.ok}</p>}
      </div>
    </form>
  );
}
