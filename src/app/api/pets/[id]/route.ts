import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().min(1),
  species: z.enum(["DOG", "CAT", "BIRD", "RABBIT", "OTHER"]),
  breed: z.string().optional(),
  weightKg: z.number().positive().optional(),
  lifeStage: z.enum(["PUPPY", "KITTEN", "ADULT_DOG", "ADULT_CAT", "SENIOR_DOG", "SENIOR_CAT"]).optional().nullable(),
  allergies: z.array(z.string()).default([]),
  birthDate: z.string().optional().nullable(),
});

type Params = { params: Promise<{ id: string }> };

async function ownedPet(userId: string, id: string) {
  return prisma.pet.findFirst({ where: { id, userId } });
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "請先登入" }, { status: 401 });
  }

  const { id } = await params;
  const pet = await ownedPet(session.user.id, id);
  if (!pet) {
    return NextResponse.json({ error: "找不到寵物檔案" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "資料格式錯誤" }, { status: 400 });
  }

  const updated = await prisma.pet.update({
    where: { id: pet.id },
    data: {
      name: parsed.data.name,
      species: parsed.data.species,
      breed: parsed.data.breed,
      weightKg: parsed.data.weightKg,
      lifeStage: parsed.data.lifeStage || null,
      allergies: parsed.data.allergies,
      birthDate: parsed.data.birthDate ? new Date(parsed.data.birthDate) : null,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "請先登入" }, { status: 401 });
  }

  const { id } = await params;
  const pet = await ownedPet(session.user.id, id);
  if (!pet) {
    return NextResponse.json({ error: "找不到寵物檔案" }, { status: 404 });
  }

  await prisma.subscription.updateMany({
    where: { petId: pet.id },
    data: { petId: null },
  });
  await prisma.pet.delete({ where: { id: pet.id } });

  return NextResponse.json({ ok: true });
}
