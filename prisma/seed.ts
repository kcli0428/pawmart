import "dotenv/config";
import {
  PrismaClient,
  ProductUnitType,
  PetSpecies,
  PetLifeStage,
} from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding PawMart...");

  const adminHash = await bcrypt.hash("admin123", 10);
  const userHash = await bcrypt.hash("demo1234", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@pawmart.hk" },
    update: {},
    create: {
      email: "admin@pawmart.hk",
      name: "Admin",
      passwordHash: adminHash,
      role: "ADMIN",
      pointsAccount: { create: {} },
    },
  });

  const demoUser = await prisma.user.upsert({
    where: { email: "demo@pawmart.hk" },
    update: {},
    create: {
      email: "demo@pawmart.hk",
      name: "Demo 家長",
      passwordHash: userHash,
      pointsAccount: { create: { balance: 500, tier: "SILVER" } },
    },
  });

  const catFood = await prisma.category.upsert({
    where: { slug: "cat-food" },
    update: {},
    create: { name: "貓糧", slug: "cat-food", description: "乾糧、濕糧、副食罐" },
  });

  const dogFood = await prisma.category.upsert({
    where: { slug: "dog-food" },
    update: {},
    create: { name: "狗糧", slug: "dog-food", description: "各階段犬隻主糧" },
  });

  const chicken = await prisma.allergen.upsert({
    where: { name: "chicken" },
    update: {},
    create: { name: "chicken", nameZh: "雞肉" },
  });

  const grain = await prisma.allergen.upsert({
    where: { name: "grain" },
    update: {},
    create: { name: "grain", nameZh: "穀物" },
  });

  const catProduct = await prisma.product.upsert({
    where: { slug: "premium-cat-pate-400g" },
    update: {},
    create: {
      name: "Premium 貓用肉泥罐 400g",
      slug: "premium-cat-pate-400g",
      brand: "PawChoice",
      description: "全齡貓適用的高蛋白肉泥罐，無穀配方。",
      categoryId: catFood.id,
      proteinPct: 11,
      fatPct: 5,
      fiberPct: 1,
      kcalPer100g: 95,
      suitableFor: [PetSpecies.CAT],
      lifeStages: [PetLifeStage.KITTEN, PetLifeStage.ADULT, PetLifeStage.SENIOR],
      variants: {
        create: [
          {
            sku: "PC-CAT-400-S",
            name: "單罐 400g",
            unitType: ProductUnitType.SINGLE,
            priceHkd: 2800,
            compareAtPrice: 3200,
            stockQuantity: 120,
            weightGrams: 400,
          },
          {
            sku: "PC-CAT-400-C12",
            name: "整箱 12 罐",
            unitType: ProductUnitType.CASE,
            unitsPerCase: 12,
            priceHkd: 28800,
            compareAtPrice: 33600,
            stockQuantity: 15,
          },
        ],
      },
      allergens: {
        create: [{ allergenId: chicken.id }],
      },
    },
    include: { variants: true },
  });

  const dogProduct = await prisma.product.upsert({
    where: { slug: "salmon-dog-kibble-2kg" },
    update: {},
    create: {
      name: "三文魚成犬糧 2kg",
      slug: "salmon-dog-kibble-2kg",
      brand: "OceanPaws",
      description: "富含 Omega-3，適合成犬日常主糧。",
      categoryId: dogFood.id,
      proteinPct: 26,
      fatPct: 14,
      fiberPct: 4,
      kcalPer100g: 360,
      suitableFor: [PetSpecies.DOG],
      lifeStages: [PetLifeStage.ADULT],
      variants: {
        create: [
          {
            sku: "OP-DOG-2KG",
            name: "2kg 袋裝",
            unitType: ProductUnitType.SINGLE,
            priceHkd: 19800,
            stockQuantity: 45,
            weightGrams: 2000,
          },
        ],
      },
    },
    include: { variants: true },
  });

  const singleVariant = catProduct.variants.find((v) => v.unitType === ProductUnitType.SINGLE)!;

  await prisma.productLot.upsert({
    where: {
      variantId_lotNumber: { variantId: singleVariant.id, lotNumber: "LOT-2026-001" },
    },
    update: {},
    create: {
      variantId: singleVariant.id,
      lotNumber: "LOT-2026-001",
      expiryDate: new Date("2026-12-31"),
      quantity: 80,
    },
  });

  await prisma.productLot.create({
    data: {
      variantId: singleVariant.id,
      lotNumber: "LOT-2025-088",
      expiryDate: new Date("2026-09-15"),
      quantity: 40,
    },
  });

  const bundleVariant = await prisma.productVariant.create({
    data: {
      productId: catProduct.id,
      sku: "PC-CAT-MIX-6",
      name: "混搭 6 罐組合包",
      unitType: ProductUnitType.BUNDLE,
      priceHkd: 15000,
      stockQuantity: 20,
    },
  });

  await prisma.bundleItem.create({
    data: {
      bundleVariantId: bundleVariant.id,
      componentVariantId: singleVariant.id,
      quantity: 6,
    },
  });

  await prisma.pet.create({
    data: {
      userId: demoUser.id,
      name: "Mochi",
      species: PetSpecies.CAT,
      breed: "英短",
      weightKg: 4.2,
      lifeStage: PetLifeStage.ADULT,
      allergies: ["穀物"],
    },
  });

  console.log("✅ Seed complete");
  console.log("   Admin: admin@pawmart.hk / admin123");
  console.log("   Demo:  demo@pawmart.hk / demo1234");
  console.log(`   Products: ${catProduct.name}, ${dogProduct.name}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
