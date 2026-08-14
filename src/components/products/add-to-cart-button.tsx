"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  variantId: string;
  disabled?: boolean;
};

export function AddToCartButton({ variantId, disabled }: Props) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleAdd() {
    setLoading(true);
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId, quantity: 1 }),
      });
      if (res.ok) setDone(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={handleAdd} disabled={disabled || loading || done} size="sm">
      {done ? "已加入" : loading ? "加入中…" : "加入購物車"}
    </Button>
  );
}
