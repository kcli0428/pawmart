import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { lookupProduct } from "@/lib/product-lookup";

export const maxDuration = 60;

const schema = z.object({
  query: z.string().min(2),
  categories: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        slug: z.string().optional(),
      }),
    )
    .default([]),
  allergens: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        nameZh: z.string().nullable(),
      }),
    )
    .default([]),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "請先輸入商品名稱" }, { status: 400 });
  }

  const result = await lookupProduct(parsed.data);
  if (!result) {
    return NextResponse.json(
      { error: "找不到足夠的公開資料，請改用更完整的名稱（建議含品牌）或手動填寫。" },
      { status: 404 },
    );
  }

  return NextResponse.json(result);
}
