import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  try {
    const users = await prisma.user.findMany({
      select: { email: true, passwordHash: true, role: true },
    });
    console.log("Users:", users);

    const demo = users.find((u) => u.email === "demo@pawmart.hk");
    if (demo?.passwordHash) {
      console.log("demo1234 valid:", await bcrypt.compare("demo1234", demo.passwordHash));
    } else {
      console.log("Demo user not found - run db:seed");
    }
  } catch (e) {
    console.error("DB error:", e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
