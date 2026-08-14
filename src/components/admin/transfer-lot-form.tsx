"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { transferLotAction, type AdminActionState } from "@/app/admin/actions";

type LotOption = { id: string; label: string };

export function TransferLotForm({ lots }: { lots: LotOption[] }) {
  const [state, formAction, pending] = useActionState<AdminActionState, FormData>(
    transferLotAction,
    null,
  );

  return (
    <form action={formAction} className="mt-4 grid gap-3 md:grid-cols-4">
      <select
        name="fromLotId"
        required
        className="rounded-lg border border-amber-200 px-3 py-2 text-sm"
      >
        <option value="">來源批號</option>
        {lots.map((lot) => (
          <option key={lot.id} value={lot.id}>
            {lot.label}
          </option>
        ))}
      </select>
      <input
        name="toLotNumber"
        required
        placeholder="目標批號"
        className="rounded-lg border border-amber-200 px-3 py-2 text-sm"
      />
      <input
        name="toExpiryDate"
        type="date"
        required
        className="rounded-lg border border-amber-200 px-3 py-2 text-sm"
      />
      <input
        name="quantity"
        type="number"
        min={1}
        required
        placeholder="調撥數量"
        className="rounded-lg border border-amber-200 px-3 py-2 text-sm"
      />
      <div className="md:col-span-4 flex items-center gap-3">
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? "調撥中…" : "批號調撥"}
        </Button>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state?.ok && <p className="text-sm text-green-700">{state.ok}</p>}
      </div>
    </form>
  );
}
