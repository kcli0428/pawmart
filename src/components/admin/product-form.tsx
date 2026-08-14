"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { saveProductAction } from "@/app/admin/product-actions";
import type { AdminActionState } from "@/app/admin/actions";
import {
  LIFE_STAGE_GROUPS,
  PET_SPECIES_LABELS,
  UNIT_TYPE_LABELS,
} from "@/lib/constants";
import type { ProductLookupResult } from "@/lib/product-lookup-parse";

type VariantDraft = {
  id?: string;
  sku: string;
  name: string;
  unitType: string;
  unitsPerCase: number;
  priceDollars: string;
  isActive: boolean;
};

type CategoryOption = { id: string; name: string; slug?: string };
type AllergenOption = { id: string; nameZh: string | null; name: string };

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
    moisturePct: number | null;
    ashPct: number | null;
    taurinePct: number | null;
    kcalPer100g: number | null;
    chondroitinMgPerKg: number | null;
    glucosamineMgPerKg: number | null;
    ingredients: string | null;
    suitableFor: string[];
    lifeStages: string[];
    allergenIds: string[];
    variants: VariantDraft[];
  };
  categories: CategoryOption[];
  allergens: AllergenOption[];
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
  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [brand, setBrand] = useState(product?.brand ?? "");
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [isActive, setIsActive] = useState(product?.isActive ?? true);
  const [proteinPct, setProteinPct] = useState(product?.proteinPct?.toString() ?? "");
  const [fatPct, setFatPct] = useState(product?.fatPct?.toString() ?? "");
  const [fiberPct, setFiberPct] = useState(product?.fiberPct?.toString() ?? "");
  const [moisturePct, setMoisturePct] = useState(product?.moisturePct?.toString() ?? "");
  const [ashPct, setAshPct] = useState(product?.ashPct?.toString() ?? "");
  const [taurinePct, setTaurinePct] = useState(product?.taurinePct?.toString() ?? "");
  const [kcalPer100g, setKcalPer100g] = useState(product?.kcalPer100g?.toString() ?? "");
  const [chondroitinMgPerKg, setChondroitinMgPerKg] = useState(
    product?.chondroitinMgPerKg?.toString() ?? "",
  );
  const [glucosamineMgPerKg, setGlucosamineMgPerKg] = useState(
    product?.glucosamineMgPerKg?.toString() ?? "",
  );
  const [ingredients, setIngredients] = useState(product?.ingredients ?? "");
  const [suitableFor, setSuitableFor] = useState<string[]>(product?.suitableFor ?? []);
  const [lifeStages, setLifeStages] = useState<string[]>(product?.lifeStages ?? []);
  const [allergenIds, setAllergenIds] = useState<string[]>(product?.allergenIds ?? []);
  const [variants, setVariants] = useState<VariantDraft[]>(
    product?.variants.length ? product.variants : [emptyVariant()],
  );
  const [lookupPending, setLookupPending] = useState(false);
  const [lookupMessage, setLookupMessage] = useState("");
  const [sources, setSources] = useState<{ title: string; url: string }[]>([]);

  function toggle(list: string[], value: string) {
    return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
  }

  function applyLookup(result: ProductLookupResult) {
    setName(result.name);
    if (result.slug) setSlug(result.slug);
    setBrand(result.brand);
    setCategoryId(result.categoryId);
    setImageUrl(result.imageUrl);
    setDescription(result.description);
    setProteinPct(result.proteinPct);
    setFatPct(result.fatPct);
    setFiberPct(result.fiberPct);
    setMoisturePct(result.moisturePct);
    setAshPct(result.ashPct);
    setTaurinePct(result.taurinePct);
    setKcalPer100g(result.kcalPer100g);
    setChondroitinMgPerKg(result.chondroitinMgPerKg);
    setGlucosamineMgPerKg(result.glucosamineMgPerKg);
    setIngredients(result.ingredients);
    if (result.suitableFor.length) setSuitableFor(result.suitableFor);
    if (result.lifeStages.length) setLifeStages(result.lifeStages);
    setAllergenIds(result.allergenIds);
    setVariants((current) => {
      if (current.some((item) => item.id)) {
        return current;
      }
      if (result.packSizes.length > 0) {
        return result.packSizes.map((size, index) => ({
          sku:
            index === 0
              ? result.variantSku
              : `${result.variantSku}-${size.toUpperCase()}`,
          name: `${size} 裝`,
          unitType: "SINGLE",
          unitsPerCase: 1,
          priceDollars: index === 0 ? result.priceDollars : "",
          isActive: true,
        }));
      }
      const next = [...current];
      if (!next[0]) next[0] = emptyVariant();
      next[0] = {
        ...next[0],
        sku: next[0].sku || result.variantSku,
        name: next[0].name || result.variantName,
        priceDollars: next[0].priceDollars || result.priceDollars,
        isActive: true,
      };
      return next;
    });
    setSources(result.sources);
  }

  async function handleLookup() {
    if (!name.trim()) {
      setLookupMessage("請先輸入商品名稱，再搜尋網上資料。");
      return;
    }
    setLookupPending(true);
    setLookupMessage("");
    try {
      const res = await fetch("/api/admin/product-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: name.trim(),
          categories,
          allergens,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLookupMessage(data.error ?? "搜尋失敗");
        return;
      }
      applyLookup(data as ProductLookupResult);
      const extra = Array.isArray((data as ProductLookupResult).notes)
        ? (data as ProductLookupResult).notes.filter(Boolean).join(" ")
        : "";
      setLookupMessage(
        extra
          ? `已填入公開資料。${extra}`
          : "已填入公開資料，請核對售價、營養與過敏原後再儲存。",
      );
    } catch {
      setLookupMessage("搜尋時發生錯誤，請稍後再試。");
    } finally {
      setLookupPending(false);
    }
  }

  return (
    <form action={formAction} className="space-y-6">
      {product && <input type="hidden" name="id" value={product.id} />}
      <input type="hidden" name="variantCount" value={variants.length} />

      <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
        <p className="text-sm font-medium">從官網與網上搜尋並填入</p>
        <p className="mt-1 text-xs text-zinc-600">
          輸入商品名稱（建議含品牌與種類，如「Ziwi Peak 風乾貓糧 鯖魚及羊肉配方」）。系統會優先讀取品牌官網商品頁的成份與保證分析。
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            name="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="商品名稱 *"
            className="flex-1 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"
          />
          <Button
            type="button"
            variant="outline"
            disabled={lookupPending || pending}
            onClick={handleLookup}
          >
            {lookupPending ? "搜尋中…" : "搜尋並填入"}
          </Button>
        </div>
        {lookupMessage && (
          <p className="mt-2 text-xs text-amber-800">{lookupMessage}</p>
        )}
        {sources.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs text-zinc-500">
            {sources.map((source) => (
              <li key={source.url}>
                來源：{source.title}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <input
          name="slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="網址 slug（可留空自動產生）"
          className="rounded-lg border border-amber-200 px-3 py-2 text-sm"
        />
        <input
          name="brand"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          placeholder="品牌"
          className="rounded-lg border border-amber-200 px-3 py-2 text-sm"
        />
        <select
          name="categoryId"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
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
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="圖片 URL（選填）"
          className="rounded-lg border border-amber-200 px-3 py-2 text-sm"
        />
        <textarea
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="商品描述"
          rows={3}
          className="md:col-span-2 rounded-lg border border-amber-200 px-3 py-2 text-sm"
        />
        <textarea
          name="ingredients"
          value={ingredients}
          onChange={(e) => setIngredients(e.target.value)}
          placeholder="主要成份"
          rows={3}
          className="md:col-span-2 rounded-lg border border-amber-200 px-3 py-2 text-sm"
        />
      </div>

      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={name || "商品圖片預覽"}
          className="h-32 w-32 rounded-xl object-cover"
        />
      )}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isActive"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
        上架
      </label>

      <div>
        <p className="text-sm font-medium">營養分析（選填，供 CRM 熱量／進階營養使用）</p>
        <div className="mt-2 grid gap-3 md:grid-cols-4">
          <input
            name="proteinPct"
            type="number"
            step="0.01"
            value={proteinPct}
            onChange={(e) => setProteinPct(e.target.value)}
            placeholder="粗蛋白質 %"
            className="rounded-lg border border-amber-200 px-3 py-2 text-sm"
          />
          <input
            name="fatPct"
            type="number"
            step="0.01"
            value={fatPct}
            onChange={(e) => setFatPct(e.target.value)}
            placeholder="粗脂肪 %"
            className="rounded-lg border border-amber-200 px-3 py-2 text-sm"
          />
          <input
            name="fiberPct"
            type="number"
            step="0.01"
            value={fiberPct}
            onChange={(e) => setFiberPct(e.target.value)}
            placeholder="粗纖維 %"
            className="rounded-lg border border-amber-200 px-3 py-2 text-sm"
          />
          <input
            name="moisturePct"
            type="number"
            step="0.01"
            value={moisturePct}
            onChange={(e) => setMoisturePct(e.target.value)}
            placeholder="水份 %"
            className="rounded-lg border border-amber-200 px-3 py-2 text-sm"
          />
          <input
            name="ashPct"
            type="number"
            step="0.01"
            value={ashPct}
            onChange={(e) => setAshPct(e.target.value)}
            placeholder="灰質 %"
            className="rounded-lg border border-amber-200 px-3 py-2 text-sm"
          />
          <input
            name="taurinePct"
            type="number"
            step="0.01"
            value={taurinePct}
            onChange={(e) => setTaurinePct(e.target.value)}
            placeholder="牛磺酸 %"
            className="rounded-lg border border-amber-200 px-3 py-2 text-sm"
          />
          <input
            name="kcalPer100g"
            type="number"
            step="0.1"
            value={kcalPer100g}
            onChange={(e) => setKcalPer100g(e.target.value)}
            placeholder="kcal / 100g"
            className="rounded-lg border border-amber-200 px-3 py-2 text-sm"
          />
          <input
            name="chondroitinMgPerKg"
            type="number"
            step="1"
            value={chondroitinMgPerKg}
            onChange={(e) => setChondroitinMgPerKg(e.target.value)}
            placeholder="硫酸軟骨素 mg/kg"
            className="rounded-lg border border-amber-200 px-3 py-2 text-sm"
          />
          <input
            name="glucosamineMgPerKg"
            type="number"
            step="1"
            value={glucosamineMgPerKg}
            onChange={(e) => setGlucosamineMgPerKg(e.target.value)}
            placeholder="葡萄糖胺 mg/kg"
            className="rounded-lg border border-amber-200 px-3 py-2 text-sm md:col-span-2"
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
                checked={suitableFor.includes(value)}
                onChange={() => setSuitableFor((current) => toggle(current, value))}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium">適用生命階段</p>
        <div className="mt-2 space-y-3">
          {LIFE_STAGE_GROUPS.map((group) => (
            <div key={group.species}>
              <p className="text-xs font-medium text-zinc-500">{group.label}</p>
              <div className="mt-1 flex flex-wrap gap-3 text-sm">
                {group.stages.map((stage) => (
                  <label key={stage.value} className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      name="lifeStages"
                      value={stage.value}
                      checked={lifeStages.includes(stage.value)}
                      onChange={() => setLifeStages((current) => toggle(current, stage.value))}
                    />
                    {stage.label}
                  </label>
                ))}
              </div>
            </div>
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
                  checked={allergenIds.includes(allergen.id)}
                  onChange={() =>
                    setAllergenIds((current) => toggle(current, allergen.id))
                  }
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
              className="grid gap-2 rounded-xl border border-amber-100 p-3 md:grid-cols-7"
            >
              {variant.id && (
                <input type="hidden" name={`variantId_${index}`} value={variant.id} />
              )}
              <input
                name={`variantSku_${index}`}
                value={variant.sku}
                onChange={(e) =>
                  setVariants((current) =>
                    current.map((item, i) =>
                      i === index ? { ...item, sku: e.target.value } : item,
                    ),
                  )
                }
                placeholder="SKU"
                className="rounded-lg border border-amber-200 px-3 py-2 text-sm"
              />
              <input
                name={`variantName_${index}`}
                value={variant.name}
                onChange={(e) =>
                  setVariants((current) =>
                    current.map((item, i) =>
                      i === index ? { ...item, name: e.target.value } : item,
                    ),
                  )
                }
                placeholder="規格名稱"
                className="rounded-lg border border-amber-200 px-3 py-2 text-sm"
              />
              <select
                name={`variantUnitType_${index}`}
                value={variant.unitType}
                onChange={(e) =>
                  setVariants((current) =>
                    current.map((item, i) =>
                      i === index ? { ...item, unitType: e.target.value } : item,
                    ),
                  )
                }
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
                value={variant.unitsPerCase}
                onChange={(e) =>
                  setVariants((current) =>
                    current.map((item, i) =>
                      i === index
                        ? { ...item, unitsPerCase: Number(e.target.value) || 1 }
                        : item,
                    ),
                  )
                }
                placeholder="每箱件數"
                className="rounded-lg border border-amber-200 px-3 py-2 text-sm"
              />
              <input
                name={`variantPrice_${index}`}
                type="number"
                min={0}
                step="0.01"
                value={variant.priceDollars}
                onChange={(e) =>
                  setVariants((current) =>
                    current.map((item, i) =>
                      i === index ? { ...item, priceDollars: e.target.value } : item,
                    ),
                  )
                }
                placeholder="售價 HKD"
                className="rounded-lg border border-amber-200 px-3 py-2 text-sm"
              />
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name={`variantActive_${index}`}
                    checked={variant.isActive}
                    onChange={(e) =>
                      setVariants((current) =>
                        current.map((item, i) =>
                          i === index ? { ...item, isActive: e.target.checked } : item,
                        ),
                      )
                    }
                  />
                  上架
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-red-700"
                  disabled={variants.length <= 1}
                  title={variants.length <= 1 ? "至少保留一個規格" : "刪除規格"}
                  onClick={() =>
                    setVariants((current) =>
                      current.length <= 1 ? current : current.filter((_, i) => i !== index),
                    )
                  }
                >
                  刪除
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <Button type="submit" disabled={pending || lookupPending}>
        {pending ? "儲存中…" : product ? "更新商品" : "建立商品"}
      </Button>
    </form>
  );
}
