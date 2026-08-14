import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().min(1),
  species: z.enum(["DOG", "CAT", "BIRD", "RABBIT", "OTHER"]),
  breed: z.string().optional(),
  weightKg: z.number().positive().optional(),
  lifeStage: z.enum(["PUPPY", "KITTEN", "ADULT", "SENIOR"]).optional(),
  allergies: z.array(z.string()).default([]),
  birthDate: z.string().optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "請先登入" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "資料格式錯誤" }, { status: 400 });
  }

  const pet = await prisma.pet.create({
    data: {
      userId: session.user.id,
      name: parsed.data.name,
      species: parsed.data.species,
      breed: parsed.data.breed,
      weightKg: parsed.data.weightKg,
      lifeStage: parsed.data.lifeStage,
      allergies: parsed.data.allergies,
      birthDate: parsed.data.birthDate ? new Date(parsed.data.birthDate) : undefined,
    },
  });

  return NextResponse.json(pet, { status: 201 });
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "請先登入" }, { status: 401 });
  }

  const pets = await prisma.pet.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(pets);
}
