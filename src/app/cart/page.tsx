import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatHkd } from "@/lib/utils";
import { cookies } from "next/headers";
import { CheckoutButton } from "@/components/cart/checkout-button";

async function getCartItems(userId?: string, sessionId?: string) {
  const cart = await prisma.cart.findFirst({
    where: userId ? { userId } : { sessionId },
    include: {
      items: {
        include: {
          variant: { include: { product: true } },
        },
      },
    },
  });
  return cart?.items ?? [];
}

export default async function CartPage() {
  const session = await auth();
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("cart_session")?.value;

  if (!session?.user && !sessionId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">購物車是空的</h1>
        <p className="mt-2 text-zinc-600">去選些毛孩好物吧！</p>
        <Link href="/products" className="mt-6 inline-block text-amber-700 hover:underline">
          瀏覽商品 →
        </Link>
      </div>
    );
  }

  const items = await getCartItems(session?.user?.id, sessionId);
  const total = items.reduce(
    (sum, item) => sum + item.variant.priceHkd * item.quantity,
    0,
  );

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">購物車是空的</h1>
        <Link href="/products" className="mt-6 inline-block text-amber-700 hover:underline">
          瀏覽商品 →
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">購物車</h1>
      <div className="mt-8 space-y-4">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between rounded-xl border border-amber-100 bg-white p-4"
          >
            <div>
              <p className="font-medium">{item.variant.product.name}</p>
              <p className="text-sm text-zinc-500">{item.variant.name}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-zinc-500">× {item.quantity}</p>
              <p className="font-semibold text-amber-700">
                {formatHkd(item.variant.priceHkd * item.quantity)}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl bg-amber-50 p-6">
        <div className="flex justify-between text-lg font-bold">
          <span>合計</span>
          <span className="text-amber-700">{formatHkd(total)}</span>
        </div>
        {session?.user ? (
          <CheckoutButton />
        ) : (
          <p className="mt-4 text-center text-sm text-zinc-600">
            <Link href="/login" className="text-amber-700 hover:underline">
              登入
            </Link>{" "}
            後即可結帳
          </p>
        )}
      </div>
    </div>
  );
}
