"use server";

import { redirect } from "next/navigation";
import { placeOrder } from "@/lib/checkout";
import { requireUser } from "@/lib/session";

export type CheckoutState = { error?: string } | null;

export async function checkoutAction(
  _prev: CheckoutState,
  _formData: FormData,
): Promise<CheckoutState> {
  void _prev;
  void _formData;
  const session = await requireUser();
  try {
    const order = await placeOrder(session.user.id);
    redirect(`/account/orders/${order.id}`);
  } catch (error) {
    if (error instanceof Error && error.message === "EMPTY_CART") {
      return { error: "購物車是空的" };
    }
    if (error instanceof Error && error.message.startsWith("缺貨")) {
      return { error: error.message };
    }
    if (error instanceof Error && error.message === "INSUFFICIENT_LOT_STOCK") {
      return { error: "批號庫存不足，請聯絡店員" };
    }
    if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") {
      return { error: "庫存不足" };
    }
    throw error;
  }
}
