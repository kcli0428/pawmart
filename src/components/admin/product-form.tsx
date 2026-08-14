"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { saveProductAction } from "@/app/admin/product-actions";
import type { AdminActionState } from "@/app/admin/actions";
import {
  LIFE_STAGE_LABELS,
  PET_SPECIES_LABELS,
  UNIT_TYPE_LABELS,
} from "@/lib/constants";

type VariantDraft = {
  id?: string;
  sku: string;
  name: string;
  unitType: string;
  unitsPerCase: number;
  priceDollars: string;
  isActive: boolean;
};

type ProductFormProps = {
  product?: {
    id: string;
    name: string;
    slug: string;
    brand: string | null;
    description: string | null;
    categoryId: string | null;
    imageUrl: string | null;
    isActive: boolean;
    proteinPct: number | null;
    fatPct: number | null;
    fiberPct: number | null;
    kcalPer100g: number | null;
    suitableFor: string[];
    lifeStages: string[];
    allergenIds: string[];
    variants: VariantDraft[];
  };
  categories: { id: string; name: string }[];
  allergens: { id: string; nameZh: string | null; name: string }[];
};

function emptyVariant(): VariantDraft {
  return {
    sku: "",
    name: "",
    unitType: "SINGLE",
    unitsPerCase: 1,
    priceDollars: "",
    isActive: true,
  };
}

export function ProductForm({ product, categories, allergens }: ProductFormProps) {
  const [state, formAction, pending] = useActionState<AdminActionState, FormData>(
    saveProductAction,
    null,
  );
  const [variants, setVariants] = useState<VariantDraft[]>(
    product?.variants.length ? product.variants : [emptyVariant()],
  );

  return (
    <form action={formAction} className="space-y-6">
      {product && <input type="hidden" name="id" value={product.id} />}
      <input type="hidden" name="variantCount" value={variants.length} />

      <div className="grid gap-3 md:grid-cols-2">
        <input
          name="name"
          required
          defaultValue={product?.name}
          placeholder="商品名稱 *"
          className="rounded-lg border border-amber-200 px-3 py-2 text-sm"
        />
        <input
          name="slug"
          defaultValue={product?.slug}
          placeholder="網址 slug（可留空自動產生）"
          className="rounded-lg border border-amber-200 px-3 py-2 text-sm"
        />
        <input
          name="brand"
          defaultValue={product?.brand ?? ""}
          placeholder="品牌"
          className="rounded-lg border border-amber-200 px-3 py-2 text-sm"
        />
        <select
          name="categoryId"
          defaultValue={product?.categoryId ?? ""}
          className="rounded-lg border border-amber-200 px-3 py-2 text-sm"
        >
          <option value="">未分類</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <input
          name="imageUrl"
          defaultValue={product?.imageUrl ?? ""}
          placeholder="圖片 URL（選填）"
          className="md:col-span-2 rounded-lg border border-amber-200 px-3 py-2 text-sm"
        />
        <textarea
          name="description"
          defaultValue={product?.description ?? ""}
          placeholder="商品描述"
          rows={3}
          className="md:col-span-2 rounded-lg border border-amber-200 px-3 py-2 text-sm"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={product?.isActive ?? true} />
        上架
      </label>

      <div>
        <p className="text-sm font-medium">營養資訊（選填）</p>
        <div className="mt-2 grid gap-3 md:grid-cols-4">
          <input
            name="proteinPct"
            type="number"
            step="0.1"
            defaultValue={product?.proteinPct ?? ""}
            placeholder="蛋白質 %"
            className="rounded-lg border border-amber-200 px-3 py-2 text-sm"
          />
          <input
            name="fatPct"
            type="number"
            step="0.1"
            defaultValue={product?.fatPct ?? ""}
            placeholder="脂肪 %"
            className="rounded-lg border border-amber-200 px-3 py-2 text-sm"
          />
          <input
            name="fiberPct"
            type="number"
            step="0.1"
            defaultValue={product?.fiberPct ?? ""}
            placeholder="纖維 %"
            className="rounded-lg border border-amber-200 px-3 py-2 text-sm"
          />
          <input
            name="kcalPer100g"
            type="number"
            step="0.1"
            defaultValue={product?.kcalPer100g ?? ""}
            placeholder="kcal / 100g"
            className="rounded-lg border border-amber-200 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <p className="text-sm font-medium">適用品種</p>
        <div className="mt-2 flex flex-wrap gap-3 text-sm">
          {Object.entries(PET_SPECIES_LABELS).map(([value, label]) => (
            <label key={value} className="flex items-center gap-1">
              <input
                type="checkbox"
                name="suitableFor"
                value={value}
                defaultChecked={product?.suitableFor.includes(value)}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium">適用生命階段</p>
        <div className="mt-2 flex flex-wrap gap-3 text-sm">
          {Object.entries(LIFE_STAGE_LABELS).map(([value, label]) => (
            <label key={value} className="flex items-center gap-1">
              <input
                type="checkbox"
                name="lifeStages"
                value={value}
                defaultChecked={product?.lifeStages.includes(value)}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {allergens.length > 0 && (
        <div>
          <p className="text-sm font-medium">過敏原</p>
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            {allergens.map((allergen) => (
              <label key={allergen.id} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  name="allergenId"
                  value={allergen.id}
                  defaultChecked={product?.allergenIds.includes(allergen.id)}
                />
                {allergen.nameZh ?? allergen.name}
              </label>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">規格</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setVariants((current) => [...current, emptyVariant()])}
          >
            新增規格
          </Button>
        </div>
        <div className="mt-3 space-y-4">
          {variants.map((variant, index) => (
            <div
              key={variant.id ?? `new-${index}`}
              className="grid gap-2 rounded-xl border border-amber-100 p-3 md:grid-cols-6"
            >
              {variant.id && (
                <input type="hidden" name={`variantId_${index}`} value={variant.id} />
              )}
              <input
                name={`variantSku_${index}`}
                defaultValue={variant.sku}
                placeholder="SKU"
                className="rounded-lg border border-amber-200 px-3 py-2 text-sm"
              />
              <input
                name={`variantName_${index}`}
                defaultValue={variant.name}
                placeholder="規格名稱"
                className="rounded-lg border border-amber-200 px-3 py-2 text-sm"
              />
              <select
                name={`variantUnitType_${index}`}
                defaultValue={variant.unitType}
                className="rounded-lg border border-amber-200 px-3 py-2 text-sm"
              >
                {Object.entries(UNIT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                name={`variantUnitsPerCase_${index}`}
                type="number"
                min={1}
                defaultValue={variant.unitsPerCase}
                placeholder="每箱件數"
                className="rounded-lg border border-amber-200 px-3 py-2 text-sm"
              />
              <input
                name={`variantPrice_${index}`}
                type="number"
                min={0}
                step="0.01"
                defaultValue={variant.priceDollars}
                placeholder="售價 HKD"
                className="rounded-lg border border-amber-200 px-3 py-2 text-sm"
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name={`variantActive_${index}`}
                  defaultChecked={variant.isActive}
                />
                上架
              </label>
            </div>
          ))}
        </div>
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "儲存中…" : product ? "更新商品" : "建立商品"}
      </Button>
    </form>
  );
}
