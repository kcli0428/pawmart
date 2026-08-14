"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createSubscriptionAction } from "@/app/account/actions";

type PetOption = { id: string; name: string };

export function SubscribeButton({
  variantId,
  pets,
}: {
  variantId: string;
  pets: PetOption[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  if (done) {
    return <p className="text-xs text-amber-700">已建立定期補貨</p>;
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        定期補貨
      </Button>
    );
  }

  return (
    <form
      className="space-y-2"
      action={async (formData) => {
        setPending(true);
        try {
          await createSubscriptionAction(formData);
          setDone(true);
        } finally {
          setPending(false);
        }
      }}
    >
      <input type="hidden" name="variantId" value={variantId} />
      <select
        name="petId"
        className="w-full rounded-lg border border-amber-200 px-2 py-1 text-xs"
      >
        <option value="">不指定寵物</option>
        {pets.map((pet) => (
          <option key={pet.id} value={pet.id}>
            {pet.name}
          </option>
        ))}
      </select>
      <select
        name="intervalDays"
        defaultValue="30"
        className="w-full rounded-lg border border-amber-200 px-2 py-1 text-xs"
      >
        <option value="14">每 14 天</option>
        <option value="30">每 30 天</option>
        <option value="60">每 60 天</option>
      </select>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "建立中…" : "確認訂閱"}
      </Button>
    </form>
  );
}
