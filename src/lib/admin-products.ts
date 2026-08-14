import { PET_SPECIES_LABELS } from "@/lib/constants";
import type { PetSpecies, Prisma } from "@/generated/prisma/client";

export const ADMIN_PRODUCT_SORTS = [
  { value: "updated", label: "最近更新" },
  { value: "name", label: "名稱 A–Z" },
  { value: "nameDesc", label: "名稱 Z–A" },
  { value: "brand", label: "品牌" },
  { value: "stockAsc", label: "庫存由低到高" },
  { value: "stockDesc", label: "庫存由高到低" },
] as const;

export type AdminProductSort = (typeof ADMIN_PRODUCT_SORTS)[number]["value"];

export type AdminProductQuery = {
  q: string;
  categoryId: string;
  status: "all" | "active" | "inactive";
  species: string;
  sort: AdminProductSort;
};

const SORT_VALUES = new Set<string>(ADMIN_PRODUCT_SORTS.map((item) => item.value));

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return value?.trim() ?? "";
}

export function parseAdminProductQuery(
  searchParams: Record<string, string | string[] | undefined>,
): AdminProductQuery {
  const status = firstParam(searchParams.status);
  const sort = firstParam(searchParams.sort);
  return {
    q: firstParam(searchParams.q),
    categoryId: firstParam(searchParams.categoryId),
    status: status === "active" || status === "inactive" ? status : "all",
    species: firstParam(searchParams.species),
    sort: SORT_VALUES.has(sort) ? (sort as AdminProductSort) : "updated",
  };
}

export function adminProductQueryIsFiltered(query: AdminProductQuery) {
  return Boolean(query.q || query.categoryId || query.status !== "all" || query.species);
}

export function adminProductWhere(query: AdminProductQuery): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {};
  if (query.q) {
    where.OR = [
      { name: { contains: query.q, mode: "insensitive" } },
      { brand: { contains: query.q, mode: "insensitive" } },
      {
        variants: {
          some: {
            OR: [
              { sku: { contains: query.q, mode: "insensitive" } },
              { name: { contains: query.q, mode: "insensitive" } },
            ],
          },
        },
      },
    ];
  }
  if (query.categoryId) where.categoryId = query.categoryId;
  if (query.status === "active") where.isActive = true;
  if (query.status === "inactive") where.isActive = false;
  if (query.species && query.species in PET_SPECIES_LABELS) {
    where.suitableFor = { has: query.species as PetSpecies };
  }
  return where;
}

export function adminProductOrderBy(
  sort: AdminProductSort,
): Prisma.ProductOrderByWithRelationInput {
  if (sort === "name") return { name: "asc" };
  if (sort === "nameDesc") return { name: "desc" };
  if (sort === "brand") return { brand: "asc" };
  return { updatedAt: "desc" };
}

export function productStockTotal(product: { variants: { stockQuantity: number }[] }) {
  return product.variants.reduce((sum, variant) => sum + variant.stockQuantity, 0);
}

export function sortAdminProducts<T extends { variants: { stockQuantity: number }[] }>(
  products: T[],
  sort: AdminProductSort,
): T[] {
  if (sort !== "stockAsc" && sort !== "stockDesc") return products;
  const sign = sort === "stockAsc" ? 1 : -1;
  return [...products].sort(
    (a, b) => sign * (productStockTotal(a) - productStockTotal(b)),
  );
}
