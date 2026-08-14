"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PET_SPECIES_LABELS } from "@/lib/constants";
import {
  ADMIN_PRODUCT_SORTS,
  adminProductQueryIsFiltered,
  type AdminProductQuery,
} from "@/lib/admin-products";

type CategoryOption = { id: string; name: string };

const fieldClass = "rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm";

export function AdminProductToolbar({
  query,
  categories,
}: {
  query: AdminProductQuery;
  categories: CategoryOption[];
}) {
  const router = useRouter();
  const filtered = adminProductQueryIsFiltered(query);

  function submit(form: HTMLFormElement) {
    const data = new FormData(form);
    const params = new URLSearchParams();
    for (const [key, value] of data.entries()) {
      const text = String(value).trim();
      if (!text) continue;
      if (key === "status" && text === "all") continue;
      if (key === "sort" && text === "updated") continue;
      params.set(key, text);
    }
    const qs = params.toString();
    router.push(qs ? `/admin/products?${qs}` : "/admin/products");
  }

  return (
    <form
      key={`${query.q}|${query.categoryId}|${query.status}|${query.species}|${query.sort}`}
      className="mt-6 space-y-3 rounded-2xl border border-amber-100 bg-white p-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit(event.currentTarget);
      }}
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            name="q"
            defaultValue={query.q}
            placeholder="尋找商品名稱、品牌或 SKU"
            className={`${fieldClass} w-full pl-9`}
          />
        </div>
        <Button type="submit">尋找</Button>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <select
          name="categoryId"
          defaultValue={query.categoryId}
          aria-label="分類"
          className={fieldClass}
          onChange={(event) => submit(event.currentTarget.form!)}
        >
          <option value="">全部分類</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={query.status}
          aria-label="狀態"
          className={fieldClass}
          onChange={(event) => submit(event.currentTarget.form!)}
        >
          <option value="all">全部狀態</option>
          <option value="active">上架</option>
          <option value="inactive">下架</option>
        </select>
        <select
          name="species"
          defaultValue={query.species}
          aria-label="適用品種"
          className={fieldClass}
          onChange={(event) => submit(event.currentTarget.form!)}
        >
          <option value="">全部品種</option>
          {Object.entries(PET_SPECIES_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          name="sort"
          defaultValue={query.sort}
          aria-label="排序"
          className={fieldClass}
          onChange={(event) => submit(event.currentTarget.form!)}
        >
          {ADMIN_PRODUCT_SORTS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        {filtered ? (
          <Link href="/admin/products" className="text-sm text-amber-700 hover:underline">
            清除篩選
          </Link>
        ) : null}
      </div>
    </form>
  );
}
