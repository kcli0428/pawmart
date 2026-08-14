import {
  PetLifeStage,
  PetSpecies,
  ProductUnitType,
} from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { dollarsToCents, slugify } from "@/lib/utils";
import type { AdminActionState } from "@/app/admin/actions";

const SPECIES = Object.values(PetSpecies);
const LIFE_STAGES = Object.values(PetLifeStage);
const UNIT_TYPES = Object.values(ProductUnitType);

async function uniqueProductSlug(base: string, excludeId?: string) {
  const root = base || `product-${Date.now()}`;
  let slug = root;
  let n = 0;
  while (true) {
    const existing = await prisma.product.findUnique({ where: { slug } });
    if (!existing || existing.id === excludeId) return slug;
    n += 1;
    slug = `${root}-${n}`;
  }
}

function parseVariants(formData: FormData) {
  const count = Number(formData.get("variantCount") ?? 0);
  const variants: {
    id?: string;
    sku: string;
    name: string;
    unitType: ProductUnitType;
    unitsPerCase: number;
    priceHkd: number;
    isActive: boolean;
  }[] = [];

  for (let i = 0; i < count; i += 1) {
    const sku = String(formData.get(`variantSku_${i}`) ?? "").trim();
    const name = String(formData.get(`variantName_${i}`) ?? "").trim();
    const unitType = String(formData.get(`variantUnitType_${i}`) ?? "SINGLE");
    const unitsPerCase = Number(formData.get(`variantUnitsPerCase_${i}`) ?? 1);
    const priceRaw = String(formData.get(`variantPrice_${i}`) ?? "");
    const isActive = formData.get(`variantActive_${i}`) === "on";
    const id = String(formData.get(`variantId_${i}`) ?? "").trim();

    if (!sku && !name && !priceRaw) continue;
    if (!sku || !name || !priceRaw) {
      throw new Error("請填寫完整規格（SKU、名稱、售價）");
    }
    if (!UNIT_TYPES.includes(unitType as ProductUnitType)) {
      throw new Error("無效的單位類型");
    }

    variants.push({
      id: id || undefined,
      sku,
      name,
      unitType: unitType as ProductUnitType,
      unitsPerCase: Math.max(1, unitsPerCase || 1),
      priceHkd: dollarsToCents(priceRaw),
      isActive,
    });
  }

  return variants;
}

export async function saveProductAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const slugInput = String(formData.get("slug") ?? "").trim();
  const brand = String(formData.get("brand") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const categoryId = String(formData.get("categoryId") ?? "").trim() || null;
  const imageUrl = String(formData.get("imageUrl") ?? "").trim() || null;
  const isActive = formData.get("isActive") === "on";
  const proteinPct = formData.get("proteinPct")
    ? Number(formData.get("proteinPct"))
    : null;
  const fatPct = formData.get("fatPct") ? Number(formData.get("fatPct")) : null;
  const fiberPct = formData.get("fiberPct") ? Number(formData.get("fiberPct")) : null;
  const kcalPer100g = formData.get("kcalPer100g")
    ? Number(formData.get("kcalPer100g"))
    : null;
  const suitableFor = formData
    .getAll("suitableFor")
    .map(String)
    .filter((value): value is PetSpecies => SPECIES.includes(value as PetSpecies));
  const lifeStages = formData
    .getAll("lifeStages")
    .map(String)
    .filter((value): value is PetLifeStage =>
      LIFE_STAGES.includes(value as PetLifeStage),
    );
  const allergenIds = formData.getAll("allergenId").map(String).filter(Boolean);

  if (!name) {
    return { error: "請填寫商品名稱" };
  }

  let variants;
  try {
    variants = parseVariants(formData);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "規格資料錯誤" };
  }

  if (!id && variants.length === 0) {
    return { error: "新商品至少需要一個規格" };
  }

  const slug = await uniqueProductSlug(slugify(slugInput || name), id || undefined);

  const productData = {
    name,
    slug,
    brand,
    description,
    categoryId,
    imageUrl,
    isActive,
    proteinPct,
    fatPct,
    fiberPct,
    kcalPer100g,
    suitableFor,
    lifeStages,
  };

  let product;
  try {
    product = await prisma.$transaction(async (tx) => {
      const saved = id
        ? await tx.product.update({ where: { id }, data: productData })
        : await tx.product.create({ data: productData });

      for (const variant of variants) {
        if (variant.id) {
          await tx.productVariant.update({
            where: { id: variant.id },
            data: {
              sku: variant.sku,
              name: variant.name,
              unitType: variant.unitType,
              unitsPerCase: variant.unitsPerCase,
              priceHkd: variant.priceHkd,
              isActive: variant.isActive,
            },
          });
        } else {
          await tx.productVariant.create({
            data: {
              productId: saved.id,
              sku: variant.sku,
              name: variant.name,
              unitType: variant.unitType,
              unitsPerCase: variant.unitsPerCase,
              priceHkd: variant.priceHkd,
              isActive: variant.isActive,
            },
          });
        }
      }

      await tx.productAllergen.deleteMany({ where: { productId: saved.id } });
      if (allergenIds.length > 0) {
        await tx.productAllergen.createMany({
          data: allergenIds.map((allergenId) => ({
            productId: saved.id,
            allergenId,
          })),
        });
      }

      return saved;
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Unique constraint") || message.includes("sku")) {
      return { error: "SKU 或網址已存在，請改用其他值" };
    }
    throw error;
  }

  revalidatePath("/admin/products");
  revalidatePath("/products");
  redirect(`/admin/products/${product.id}`);
}

export async function deactivateProductAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.product.update({
    where: { id },
    data: { isActive: false },
  });
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${id}`);
  revalidatePath("/products");
}
