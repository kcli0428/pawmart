import Link from "next/link";
import { ShoppingCart, PawPrint, User, LayoutDashboard } from "lucide-react";
import { auth } from "@/lib/auth";
import { SITE_NAME } from "@/lib/constants";

export async function Header() {
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <header className="sticky top-0 z-50 border-b border-amber-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-amber-700">
          <PawPrint className="h-6 w-6" />
          <span className="text-xl">{SITE_NAME}</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-zinc-700 md:flex">
          <Link href="/products" className="hover:text-amber-700">
            全部商品
          </Link>
          <Link href="/account/pets" className="hover:text-amber-700">
            我的寵物
          </Link>
          {isAdmin && (
            <Link href="/admin" className="flex items-center gap-1 hover:text-amber-700">
              <LayoutDashboard className="h-4 w-4" />
              後台
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/cart"
            className="rounded-full p-2 text-zinc-700 hover:bg-amber-50 hover:text-amber-700"
            aria-label="購物車"
          >
            <ShoppingCart className="h-5 w-5" />
          </Link>
          {session?.user ? (
            <Link
              href="/account/pets"
              className="flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-800"
            >
              <User className="h-4 w-4" />
              {session.user.name ?? "會員"}
            </Link>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-amber-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
            >
              登入
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
