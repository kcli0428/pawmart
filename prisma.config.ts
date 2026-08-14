import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ path: ".env" });
if (!process.env.DATABASE_URL) {
  config({ path: ".env.example" });
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is missing. Copy .env.example to .env and try again: cp .env.example .env",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
