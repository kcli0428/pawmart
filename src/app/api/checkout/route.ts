import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { placeOrder } from "@/lib/checkout";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "請先登入" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { redeemPoints?: number };

  try {
    const order = await placeOrder(session.user.id, {
      redeemPoints: Number(body.redeemPoints ?? 0),
    });
    return NextResponse.json({
      message: "訂單已建立",
      orderId: order.id,
      orderNumber: order.orderNumber,
      totalHkd: order.totalHkd,
      pointsRedeemed: order.pointsRedeemed,
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
