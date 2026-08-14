"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  updateSubscriptionDetailsAction,
  type SubscriptionActionState,
} from "@/app/account/actions";
import { SUBSCRIPTION_INTERVALS } from "@/lib/constants";

type VariantOption = { id: string; name: string };
type PetOption = { id: string; name: string };

export function SubscriptionEditor({
  subscription,
  variants,
  pets,
}: {
  subscription: {
    id: string;
    variantId: string;
    petId: string | null;
    intervalDays: number;
    quantity: number;
    nextDeliveryAt: string;
  };
  variants: VariantOption[];
  pets: PetOption[];
}) {
  const [state, formAction, pending] = useActionState<SubscriptionActionState, FormData>(
    updateSubscriptionDetailsAction,
    null,
  );

  return (
    <form action={formAction} className="mt-4 grid gap-2 sm:grid-cols-2">
      <input type="hidden" name="id" value={subscription.id} />
      <select
        name="variantId"
        defaultValue={subscription.variantId}
        className="rounded-lg border border-amber-200 px-3 py-2 text-sm"
      >
        {variants.map((variant) => (
          <option key={variant.id} value={variant.id}>
            {variant.name}
          </option>
        ))}
      </select>
      <select
        name="intervalDays"
        defaultValue={String(subscription.intervalDays)}
        className="rounded-lg border border-amber-200 px-3 py-2 text-sm"
      >
        {SUBSCRIPTION_INTERVALS.map((days) => (
          <option key={days} value={days}>
            每 {days} 天
          </option>
        ))}
      </select>
      <input
        type="number"
        name="quantity"
        min={1}
        defaultValue={subscription.quantity}
        className="rounded-lg border border-amber-200 px-3 py-2 text-sm"
      />
      <input
        type="date"
        name="nextDeliveryAt"
        defaultValue={subscription.nextDeliveryAt}
        className="rounded-lg border border-amber-200 px-3 py-2 text-sm"
      />
      <select
        name="petId"
        defaultValue={subscription.petId ?? ""}
        className="rounded-lg border border-amber-200 px-3 py-2 text-sm sm:col-span-2"
      >
        <option value="">不指定寵物</option>
        {pets.map((pet) => (
          <option key={pet.id} value={pet.id}>
            {pet.name}
          </option>
        ))}
      </select>
      {state?.error && <p className="text-sm text-red-600 sm:col-span-2">{state.error}</p>}
      {state?.ok && <p className="text-sm text-amber-700 sm:col-span-2">{state.ok}</p>}
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "儲存中…" : "儲存變更"}
      </Button>
    </form>
  );
}
