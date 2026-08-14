import Link from "next/link";
import { PawPrint } from "lucide-react";
import { SITE_NAME } from "@/lib/constants";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-amber-100 bg-amber-50/50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-6 md:flex-row md:justify-between">
          <div>
            <div className="flex items-center gap-2 font-bold text-amber-700">
              <PawPrint className="h-5 w-5" />
              {SITE_NAME}
            </div>
            <p className="mt-2 max-w-sm text-sm text-zinc-600">
              香港寵物用品零售平台。個人化推薦、多寵物檔案、訂閱補貨，讓照顧毛孩更輕鬆。
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 text-sm">
            <div>
              <h3 className="font-semibold text-zinc-800">購物</h3>
              <ul className="mt-2 space-y-1 text-zinc-600">
                <li><Link href="/products">全部商品</Link></li>
                <li><Link href="/account/pets">我的寵物</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-zinc-800">支援</h3>
              <ul className="mt-2 space-y-1 text-zinc-600">
                <li>配送：香港本地</li>
                <li>金流：Stripe（HKD）</li>
              </ul>
            </div>
          </div>
        </div>
        <p className="mt-8 text-center text-xs text-zinc-500">
          © {new Date().getFullYear()} {SITE_NAME}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
