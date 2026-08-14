import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { placeOrder } from "@/lib/checkout";

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "請先登入" }, { status: 401 });
  }

  try {
    const order = await placeOrder(session.user.id);
    return NextResponse.json({
      message: "訂單已建立",
      orderId: order.id,
      orderNumber: order.orderNumber,
      totalHkd: order.totalHkd,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "EMPTY_CART") {
      return NextResponse.json({ error: "購物車是空的" }, { status: 400 });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
